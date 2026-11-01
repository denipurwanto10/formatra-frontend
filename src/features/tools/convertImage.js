// Client-side image format conversion (JPG/PNG/WEBP, any direction) using the
// canvas API. No server round-trip needed — this is just decode -> draw ->
// re-encode, which every modern browser can do natively.

const MIME_BY_FORMAT = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export const IMAGE_FORMATS = [
  { id: "png", label: "PNG", ext: "png", mime: "image/png" },
  { id: "jpg", label: "JPG", ext: "jpg", mime: "image/jpeg" },
  { id: "webp", label: "WEBP", ext: "webp", mime: "image/webp" },
];

/** Guess a sane default *target* format from the source file's extension —
 * i.e. whichever of PNG/JPG is not the source, so the button isn't a no-op. */
export function guessDefaultTarget(file) {
  const ext = (file?.name?.split(".").pop() || "").toLowerCase();
  if (ext === "png") return "jpg";
  return "png";
}

/**
 * Converts `file` (any raster image the browser can decode — JPG, PNG, WEBP,
 * GIF, BMP, etc.) into the given target format.
 *
 * @param {File} file
 * @param {"png"|"jpg"|"jpeg"|"webp"} targetFormat
 * @param {(progress:number)=>void} [onProgress]
 * @returns {Promise<Blob>}
 */
export async function convertImage(file, targetFormat, onProgress) {
  onProgress?.(5);
  const mime = MIME_BY_FORMAT[targetFormat] || "image/png";

  const source = await loadImageSource(file);
  onProgress?.(45);

  const width = source.width || source.naturalWidth;
  const height = source.height || source.naturalHeight;
  if (!width || !height) {
    throw new Error("Gagal membaca dimensi gambar. File mungkin rusak atau formatnya tidak didukung browser.");
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
  onProgress?.(75);

  if (source.close) source.close(); // release ImageBitmap memory

  const quality = mime === "image/png" ? undefined : 0.92;
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Browser gagal membuat file gambar hasil konversi."))),
      mime,
      quality
    );
  });
  onProgress?.(100);
  return blob;
}

export async function loadImageSource(file) {
  if (typeof createImageBitmap === "function") {
    try {
      // Without imageOrientation: "from-image", createImageBitmap ignores
      // the EXIF Orientation tag and hands back the raw sensor-oriented
      // pixels, which is what made phone photos come out rotated after
      // conversion — this bakes the correct rotation in at decode time.
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // Some browsers can't decode certain WEBP/GIF variants via
      // createImageBitmap — fall back to a plain <img> element below.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () =>
        reject(new Error("Gagal membaca file gambar. Pastikan formatnya JPG, PNG, atau WEBP yang valid."));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
