// Client-side speed change via ffmpeg.wasm: video timestamps are scaled with
// setpts, audio is time-stretched with atempo (pitch-preserving). ffmpeg's
// atempo filter only accepts factors between 0.5 and 2.0, so factors outside
// that range are achieved by chaining multiple atempo stages. Runs entirely
// in the browser.

import { fetchFile } from "@ffmpeg/util";
import { loadFFmpeg, setFFmpegProgressHandler, extensionOf } from "../../lib/ffmpeg";

export const SPEED_PRESETS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];

/** Builds a chain of atempo filters (each within [0.5, 2.0]) that together
 * multiply tempo by `speed`. */
function atempoChain(speed) {
  let remaining = speed;
  const stages = [];
  if (remaining < 0.5) {
    while (remaining < 0.5) {
      stages.push(0.5);
      remaining /= 0.5;
    }
    stages.push(Number(remaining.toFixed(4)));
  } else if (remaining > 2.0) {
    while (remaining > 2.0) {
      stages.push(2.0);
      remaining /= 2.0;
    }
    stages.push(Number(remaining.toFixed(4)));
  } else {
    stages.push(Number(remaining.toFixed(4)));
  }
  return stages.map((s) => `atempo=${s}`).join(",");
}

/**
 * @param {File} file
 * @param {number} speed multiplier, e.g. 0.5 for half speed, 2 for double speed
 * @param {(progress:number)=>void} [onProgress]
 * @returns {Promise<Blob>}
 */
export async function changeVideoSpeed(file, speed, onProgress) {
  const rate = Number(speed) > 0 ? Number(speed) : 1;

  onProgress?.(2);
  const ffmpeg = await loadFFmpeg();
  onProgress?.(10);

  const inputName = `input.${extensionOf(file.name) || "mp4"}`;
  const outputName = "output.mp4";

  await ffmpeg.writeFile(inputName, await fetchFile(file));

  const withAudioArgs = [
    "-i",
    inputName,
    "-filter_complex",
    `[0:v]setpts=PTS/${rate}[v];[0:a]${atempoChain(rate)}[a]`,
    "-map",
    "[v]",
    "-map",
    "[a]",
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
  // No-audio fallback for silent source clips (mapping a non-existent [0:a]
  // would otherwise fail the whole command).
  const videoOnlyArgs = [
    "-i",
    inputName,
    "-vf",
    `setpts=PTS/${rate}`,
    "-an",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "23",
    "-movflags",
    "+faststart",
    outputName,
  ];

  setFFmpegProgressHandler((p) => onProgress?.(10 + Math.round(p * 88)));
  try {
    try {
      await ffmpeg.exec(withAudioArgs);
    } catch {
      await Promise.allSettled([ffmpeg.deleteFile(outputName)]);
      await ffmpeg.exec(videoOnlyArgs);
    }
  } finally {
    setFFmpegProgressHandler(null);
  }

  const data = await ffmpeg.readFile(outputName);
  await Promise.allSettled([ffmpeg.deleteFile(inputName), ffmpeg.deleteFile(outputName)]);

  if (!data || !data.length) {
    throw new Error("Gagal mengubah kecepatan video. Pastikan video ini punya trek audio.");
  }

  onProgress?.(100);
  return new Blob([data.buffer], { type: "video/mp4" });
}
