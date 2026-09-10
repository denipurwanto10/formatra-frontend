// Client-side video compression via ffmpeg.wasm (H.264/AAC re-encode with a
// target CRF + optional resolution cap). Runs entirely in the browser — the
// video is never uploaded anywhere.

import { fetchFile } from "@ffmpeg/util";
import { loadFFmpeg, setFFmpegProgressHandler, extensionOf } from "../../lib/ffmpeg";

export const COMPRESS_LEVELS = [
  {
    id: "light",
    label: "Ringan",
    crf: 24,
    scale: null,
    description: "Kualitas nyaris sama, ukuran berkurang sedikit.",
  },
  {
    id: "balanced",
    label: "Seimbang",
    crf: 28,
    scale: 1080,
    description: "Turun ke maks. 1080p. Penghematan ukuran cukup besar dengan kualitas masih bagus.",
  },
  {
    id: "strong",
    label: "Kuat",
    crf: 32,
    scale: 720,
    description: "Turun ke maks. 720p. Ukuran file paling kecil, kualitas visual menurun.",
  },
];

/**
 * @param {File} file
 * @param {"light"|"balanced"|"strong"} levelId
 * @param {(progress:number)=>void} [onProgress]
 * @returns {Promise<Blob>}
 */
export async function compressVideo(file, levelId, onProgress) {
  const level = COMPRESS_LEVELS.find((l) => l.id === levelId) || COMPRESS_LEVELS[1];

  onProgress?.(2);
  const ffmpeg = await loadFFmpeg();
  onProgress?.(10);

  const inputName = `input.${extensionOf(file.name) || "mp4"}`;
  const outputName = "output.mp4";

  await ffmpeg.writeFile(inputName, await fetchFile(file));

  const args = ["-i", inputName];
  if (level.scale) {
    // Cap the longer side at `scale`px, keep aspect ratio, even dimensions
    // (required by libx264) — never *upscale* a smaller source.
    args.push(
      "-vf",
      `scale='if(gt(iw,ih),min(${level.scale},iw),-2)':'if(gt(iw,ih),-2,min(${level.scale},ih))'`
    );
  }
  args.push(
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    String(level.crf),
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
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
    throw new Error("Gagal mengompres video. Format file mungkin tidak didukung.");
  }

  onProgress?.(100);
  return new Blob([data.buffer], { type: "video/mp4" });
}
