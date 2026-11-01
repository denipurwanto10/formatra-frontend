// Client-side video → GIF conversion via ffmpeg.wasm. Uses the standard
// two-pass palette technique (palettegen + paletteuse) for noticeably better
// color quality than a naive single-pass GIF encode. Runs entirely in the
// browser — the video is never uploaded anywhere.

import { fetchFile } from "@ffmpeg/util";
import { loadFFmpeg, setFFmpegProgressHandler, extensionOf } from "../../lib/ffmpeg";

export const GIF_MAX_DURATION = 20; // keep output GIFs reasonably sized

/**
 * @param {File} file
 * @param {{start?:number, end?:number, fps?:number, width?:number}} options
 * @param {(progress:number)=>void} [onProgress]
 * @returns {Promise<Blob>}
 */
export async function videoToGif(file, options, onProgress) {
  const { start = 0, end = null, fps = 12, width = 480 } = options || {};

  onProgress?.(2);
  const ffmpeg = await loadFFmpeg();
  onProgress?.(10);

  const inputName = `input.${extensionOf(file.name) || "mp4"}`;
  const outputName = "output.gif";

  await ffmpeg.writeFile(inputName, await fetchFile(file));

  const trimStart = Math.max(0, Number(start) || 0);
  const args = [];
  if (trimStart > 0) args.push("-ss", String(trimStart));
  args.push("-i", inputName);
  if (end != null && Number(end) > trimStart) {
    args.push("-t", String(Number(end) - trimStart));
  }

  const scale = `scale=${Math.max(64, Math.round(width))}:-1:flags=lanczos`;
  args.push(
    "-vf",
    `fps=${Math.max(1, Math.round(fps))},${scale},split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer`,
    "-loop",
    "0",
    outputName
  );

  setFFmpegProgressHandler((p) => onProgress?.(10 + Math.round(p * 88)));
  try {
    await ffmpeg.exec(args);
  } finally {
    setFFmpegProgressHandler(null);
  }

  const data = await ffmpeg.readFile(outputName);
  await Promise.allSettled([ffmpeg.deleteFile(inputName), ffmpeg.deleteFile(outputName)]);

  if (!data || !data.length) {
    throw new Error("Gagal membuat GIF. Coba perpendek durasi atau turunkan resolusinya.");
  }

  onProgress?.(100);
  return new Blob([data.buffer], { type: "image/gif" });
}
