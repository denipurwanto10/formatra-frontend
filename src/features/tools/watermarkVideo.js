// Client-side video watermarking via ffmpeg.wasm. The watermark text is
// rendered once to a transparent PNG using a <canvas> (so we get proper
// font rendering without needing fontconfig inside ffmpeg.wasm), then that
// single image is overlaid onto every frame of the video. Layout options
// (diagonal / center / tiled) mirror the existing "Watermark PDF" tool for a
// consistent feel. Runs entirely in the browser.

import { fetchFile } from "@ffmpeg/util";
import { loadFFmpeg, setFFmpegProgressHandler, extensionOf } from "../../lib/ffmpeg";

export const WATERMARK_LAYOUTS = [
  { id: "diagonal", label: "Diagonal" },
  { id: "center", label: "Tengah" },
  { id: "tiled", label: "Berulang" },
];

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean, 16);
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
}

/**
 * Renders the watermark text onto a transparent canvas sized to match the
 * video frame, returning a PNG Blob.
 *
 * @param {{width:number, height:number}} dims frame size to match
 * @param {{text:string, opacity:number, rotation:number, fontSize:number, layout:"diagonal"|"center"|"tiled", color:string}} opts
 */
export function renderWatermarkOverlay(dims, opts) {
  const { width, height } = dims;
  const { text, opacity = 0.35, rotation = -35, fontSize = 42, layout = "diagonal", color = "#ffffff" } = opts;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, width, height);

  const [r, g, b] = hexToRgb(color);
  ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";

  const drawAt = (x, y, rot) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((rot * Math.PI) / 180);
    ctx.fillText(text, 0, 0);
    ctx.restore();
  };

  if (layout === "tiled") {
    const textWidth = ctx.measureText(text).width;
    const stepX = textWidth + 90;
    const stepY = fontSize + 90;
    for (let y = -height; y < height * 2; y += stepY) {
      for (let x = -width; x < width * 2; x += stepX) {
        drawAt(x, y, rotation);
      }
    }
  } else {
    drawAt(width / 2, height / 2, layout === "center" ? 0 : rotation);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Gagal membuat lapisan watermark."));
    }, "image/png");
  });
}

/**
 * @param {File} file
 * @param {{width:number,height:number}} dims natural pixel size of the video
 * @param {{text:string, opacity?:number, rotation?:number, fontSize?:number, layout?:string, color?:string}} opts
 * @param {(progress:number)=>void} [onProgress]
 * @returns {Promise<Blob>}
 */
export async function watermarkVideo(file, dims, opts, onProgress) {
  if (!dims?.width || !dims?.height) throw new Error("Dimensi video tidak terbaca.");
  const { text } = opts || {};
  if (!text || !text.trim()) throw new Error("Isi teks watermark terlebih dahulu.");

  onProgress?.(2);
  const overlayBlob = await renderWatermarkOverlay(dims, opts);
  onProgress?.(6);

  const ffmpeg = await loadFFmpeg();
  onProgress?.(12);

  const inputName = `input.${extensionOf(file.name) || "mp4"}`;
  const overlayName = "watermark.png";
  const outputName = "output.mp4";

  await ffmpeg.writeFile(inputName, await fetchFile(file));
  await ffmpeg.writeFile(overlayName, await fetchFile(overlayBlob));

  const baseArgs = [
    "-i",
    inputName,
    "-i",
    overlayName,
    "-filter_complex",
    "[0:v][1:v]overlay=0:0:format=auto",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "23",
  ];
  const withAudioArgs = [...baseArgs, "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", outputName];
  const noAudioArgs = [...baseArgs, "-an", "-movflags", "+faststart", outputName];

  setFFmpegProgressHandler((p) => onProgress?.(12 + Math.round(p * 86)));
  try {
    try {
      await ffmpeg.exec(withAudioArgs);
    } catch {
      await Promise.allSettled([ffmpeg.deleteFile(outputName)]);
      await ffmpeg.exec(noAudioArgs);
    }
  } finally {
    setFFmpegProgressHandler(null);
  }

  const data = await ffmpeg.readFile(outputName);
  await Promise.allSettled([
    ffmpeg.deleteFile(inputName),
    ffmpeg.deleteFile(overlayName),
    ffmpeg.deleteFile(outputName),
  ]);

  if (!data || !data.length) {
    throw new Error("Gagal menambahkan watermark ke video.");
  }

  onProgress?.(100);
  return new Blob([data.buffer], { type: "video/mp4" });
}
