// Client-side video cropping via ffmpeg.wasm. Crop area is expressed as
// percentage margins (top/right/bottom/left) trimmed from each edge, mirroring
// the existing PDF crop tool's UX. Runs entirely in the browser.

import { fetchFile } from "@ffmpeg/util";
import { loadFFmpeg, setFFmpegProgressHandler, extensionOf } from "../../lib/ffmpeg";

/** Rounds down to the nearest even number (libx264 requires even width/height). */
function even(n) {
  const v = Math.floor(n);
  return v % 2 === 0 ? v : v - 1;
}

/**
 * @param {File} file
 * @param {{top:number,right:number,bottom:number,left:number}} marginsPct percentages 0-100
 * @param {{width:number,height:number}} sourceDims natural pixel size of the video
 * @param {(progress:number)=>void} [onProgress]
 * @returns {Promise<Blob>}
 */
export async function cropVideo(file, marginsPct, sourceDims, onProgress) {
  const { top = 0, right = 0, bottom = 0, left = 0 } = marginsPct || {};
  const { width, height } = sourceDims || {};
  if (!width || !height) throw new Error("Dimensi video tidak terbaca.");

  const cropW = even(width * (1 - (left + right) / 100));
  const cropH = even(height * (1 - (top + bottom) / 100));
  const x = even(width * (left / 100));
  const y = even(height * (top / 100));

  if (cropW < 16 || cropH < 16) {
    throw new Error("Area crop terlalu kecil.");
  }

  onProgress?.(2);
  const ffmpeg = await loadFFmpeg();
  onProgress?.(10);

  const inputName = `input.${extensionOf(file.name) || "mp4"}`;
  const outputName = "output.mp4";

  await ffmpeg.writeFile(inputName, await fetchFile(file));

  const args = [
    "-i",
    inputName,
    "-vf",
    `crop=${cropW}:${cropH}:${x}:${y}`,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "23",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    outputName,
  ];

  setFFmpegProgressHandler((p) => onProgress?.(10 + Math.round(p * 88)));
  try {
    await ffmpeg.exec(args);
  } finally {
    setFFmpegProgressHandler(null);
  }

  const data = await ffmpeg.readFile(outputName);
  await Promise.allSettled([ffmpeg.deleteFile(inputName), ffmpeg.deleteFile(outputName)]);

  if (!data || !data.length) {
    throw new Error("Gagal memotong area video.");
  }

  onProgress?.(100);
  return new Blob([data.buffer], { type: "video/mp4" });
}
