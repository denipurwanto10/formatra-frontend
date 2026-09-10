// Client-side video editing (trim, rotate, mute) via ffmpeg.wasm. Runs
// entirely in the browser — the video is never uploaded anywhere.

import { fetchFile } from "@ffmpeg/util";
import { loadFFmpeg, setFFmpegProgressHandler, extensionOf } from "../../lib/ffmpeg";

export const ROTATE_OPTIONS = [0, 90, 180, 270];

function rotationFilter(rotate) {
  if (rotate === 90) return "transpose=1";
  if (rotate === 180) return "transpose=2,transpose=2";
  if (rotate === 270) return "transpose=2";
  return null;
}

/**
 * @param {File} file
 * @param {{start?:number, end?:number|null, rotate?:0|90|180|270, mute?:boolean}} options
 * @param {(progress:number)=>void} [onProgress]
 * @returns {Promise<Blob>}
 */
export async function editVideo(file, options, onProgress) {
  const { start = 0, end = null, rotate = 0, mute = false } = options || {};

  onProgress?.(2);
  const ffmpeg = await loadFFmpeg();
  onProgress?.(10);

  const inputName = `input.${extensionOf(file.name) || "mp4"}`;
  const outputName = "output.mp4";

  await ffmpeg.writeFile(inputName, await fetchFile(file));

  const args = [];
  const trimStart = Math.max(0, Number(start) || 0);
  if (trimStart > 0) args.push("-ss", String(trimStart));
  args.push("-i", inputName);

  if (end != null && Number(end) > trimStart) {
    args.push("-t", String(Number(end) - trimStart));
  }

  const filter = rotationFilter(rotate);
  if (filter) args.push("-vf", filter);

  args.push("-c:v", "libx264", "-preset", "veryfast", "-crf", "23");
  if (mute) {
    args.push("-an");
  } else {
    args.push("-c:a", "aac", "-b:a", "128k");
  }
  args.push("-movflags", "+faststart", outputName);

  setFFmpegProgressHandler((p) => onProgress?.(10 + Math.round(p * 88)));
  try {
    await ffmpeg.exec(args);
  } finally {
    setFFmpegProgressHandler(null);
  }

  const data = await ffmpeg.readFile(outputName);
  await Promise.allSettled([ffmpeg.deleteFile(inputName), ffmpeg.deleteFile(outputName)]);

  if (!data || !data.length) {
    throw new Error("Gagal mengedit video. Coba periksa rentang potong atau format filenya.");
  }

  onProgress?.(100);
  return new Blob([data.buffer], { type: "video/mp4" });
}

/** Reads basic metadata (duration in seconds) from a video file via a
 * throwaway <video> element — used to seed sane default trim bounds. */
export function readVideoDuration(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      URL.revokeObjectURL(url);
      resolve(duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Gagal membaca durasi video."));
    };
    video.src = url;
  });
}
