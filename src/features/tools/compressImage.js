// Client-side image compression (PNG/JPG/WEBP) using the canvas API — no
// server round-trip, same "decode -> draw -> re-encode" approach as
// convertImage.js, plus two extra levers that actually shrink file size:
//
//  - resizing to a max dimension (by far the biggest lever for large photos)
//  - a quality control that maps to the browser's native lossy encoder for
//    JPEG/WEBP, and to a posterization pass for PNG (a lossless format whose
//    canvas encoder ignores the `quality` argument entirely — reducing the
//    number of distinct colors is the only canvas-only way to give DEFLATE
//    less entropy to encode, so it's the closest equivalent to "PNG quality").

import { loadImageSource } from "./convertImage";

const MIME_BY_EXT = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

export const MAX_DIMENSION_PRESETS = [
  { id: "original", label: "Ukuran asli", value: null },
  { id: "2000", label: "Maks 2000px", value: 2000 },
  { id: "1600", label: "Maks 1600px", value: 1600 },
  { id: "1200", label: "Maks 1200px", value: 1200 },
  { id: "800", label: "Maks 800px", value: 800 },
];

/** Normalizes a filename/format string to the canonical 3-letter extension used for output. */
export function extFromFormat(format) {
  return format === "jpeg" ? "jpg" : format;
}

/** Picks the input file's own format as the default compression target (keep format, shrink size). */
export function guessSourceFormat(file) {
  const ext = (file?.name?.split(".").pop() || "").toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "jpg";
  if (ext === "webp") return "webp";
  return "png";
}

/** Reduces per-channel color depth so a lossless PNG re-encode has far fewer
 * distinct colors to compress — visible as mild banding at low levels, but a
 * real byte-size reduction, similar in spirit to palette/quantization-based
 * PNG compressors. `levels` ranges roughly 8 (smallest) to 256 (no-op). */
function posterizeImageData(imageData, levels) {
  if (levels >= 256) return imageData;
  const step = 255 / (levels - 1);
  const { data } = imageData;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.round(Math.round(data[i] / step) * step);
    data[i + 1] = Math.round(Math.round(data[i + 1] / step) * step);
    data[i + 2] = Math.round(Math.round(data[i + 2] / step) * step);
  }
  return imageData;
}

/**
 * @param {File} file
 * @param {object} options
 * @param {"png"|"jpg"|"jpeg"|"webp"} [options.format] output format; defaults to the source file's own format
 * @param {number} [options.quality] 0..1 — maps to native encoder quality for jpg/webp, to color-posterization for png
 * @param {number|null} [options.maxDimension] cap the longest side to this many pixels, or null to keep original size
 * @param {number|null} [options.targetSizeMB] target output size in MB; if set, will iteratively compress until under this size
 * @param {(progress:number)=>void} [onProgress]
 * @returns {Promise<Blob>}
 */
export async function compressImage(file, options = {}, onProgress) {
  const { format = guessSourceFormat(file), quality = 0.75, maxDimension = null, targetSizeMB = null } = options;
  onProgress?.(5);

  const targetExt = format === "jpeg" ? "jpg" : format;
  const mime = MIME_BY_EXT[targetExt] || file.type || "image/png";

  const source = await loadImageSource(file);
  onProgress?.(30);

  let width = source.width || source.naturalWidth;
  let height = source.height || source.naturalHeight;
  if (!width || !height) {
    throw new Error("Gagal membaca dimensi gambar. File mungkin rusak atau formatnya tidak didukung browser.");
  }

  // If target size is specified, use iterative compression
  if (targetSizeMB && targetSizeMB > 0) {
    const targetBytes = targetSizeMB * 1024 * 1024;
    let currentQuality = quality;
    let currentMaxDim = maxDimension;
    let result = null;
    let workWidth = width;
    let workHeight = height;

    // Honor the user's max-dimension choice on the very first pass —
    // otherwise the initial attempt ignores it and the loop only shrinks
    // dimensions after quality bottoms out, wasting output quality.
    if (currentMaxDim && Math.max(workWidth, workHeight) > currentMaxDim) {
      const scale = currentMaxDim / Math.max(workWidth, workHeight);
      workWidth = Math.max(1, Math.round(workWidth * scale));
      workHeight = Math.max(1, Math.round(workHeight * scale));
    }

    // First pass: try with current settings
    result = await compressImageSinglePass(source, mime, workWidth, workHeight, currentQuality);

    // Iteratively reduce quality/dimensions until under target size
    let iterations = 0;
    const maxIterations = 15;
    while (result.size > targetBytes && iterations < maxIterations) {
      iterations++;
      onProgress?.(30 + Math.round((iterations / maxIterations) * 40));

      // Reduce quality first, then dimensions
      if (currentQuality > 0.3) {
        currentQuality = Math.max(0.1, currentQuality - 0.1);
      } else if (currentMaxDim || Math.max(workWidth, workHeight) > 400) {
        currentMaxDim = currentMaxDim ? Math.max(200, currentMaxDim - 200) : Math.max(400, Math.max(workWidth, workHeight) - 200);
        const scale = currentMaxDim / Math.max(workWidth, workHeight);
        workWidth = Math.max(1, Math.round(workWidth * scale));
        workHeight = Math.max(1, Math.round(workHeight * scale));
      } else {
        break; // Can't reduce further
      }

      result = await compressImageSinglePass(source, mime, workWidth, workHeight, currentQuality);
    }

    if (source.close) source.close();
    onProgress?.(100);

    if (result.size > targetBytes) {
      console.warn(`Tidak bisa kompres ke bawah ${targetSizeMB}MB. Hasil terbaik: ${(result.size / (1024 * 1024)).toFixed(2)}MB`);
    }
    return result;
  }

  // Standard compression without target size
  if (maxDimension && Math.max(width, height) > maxDimension) {
    const scale = maxDimension / Math.max(width, height);
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  // JPG has no alpha channel — flatten onto white first, otherwise
  // transparent areas render as black in most viewers.
  if (mime === "image/jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(source, 0, 0, width, height);
  if (source.close) source.close(); // release ImageBitmap memory
  onProgress?.(55);

  const clampedQuality = Math.min(1, Math.max(0.05, quality));

  if (mime === "image/png" && clampedQuality < 1) {
    const levels = Math.max(8, Math.round(8 + clampedQuality * 248));
    const imageData = ctx.getImageData(0, 0, width, height);
    posterizeImageData(imageData, levels);
    ctx.putImageData(imageData, 0, 0);
  }
  onProgress?.(75);

  const encodeQuality = mime === "image/png" ? undefined : clampedQuality;
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Browser gagal mengompres gambar."))),
      mime,
      encodeQuality
    );
  });
  onProgress?.(100);
  return blob;
}

/** Helper: single-pass compression for iterative target-size mode */
async function compressImageSinglePass(source, mime, width, height, quality) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  if (mime === "image/jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(source, 0, 0, width, height);

  const clampedQuality = Math.min(1, Math.max(0.05, quality));

  if (mime === "image/png" && clampedQuality < 1) {
    const levels = Math.max(8, Math.round(8 + clampedQuality * 248));
    const imageData = ctx.getImageData(0, 0, width, height);
    posterizeImageData(imageData, levels);
    ctx.putImageData(imageData, 0, 0);
  }

  const encodeQuality = mime === "image/png" ? undefined : clampedQuality;
  return await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Browser gagal mengompres gambar."))),
      mime,
      encodeQuality
    );
  });
}
