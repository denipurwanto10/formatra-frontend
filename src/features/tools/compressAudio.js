// Client-side "shrink audio only" via ffmpeg.wasm: the video stream is
// stream-copied (-c:v copy, no re-encode) while only the audio track is
// re-encoded at a lower bitrate. This is much faster than a full video
// compress pass and is the right tool when the video quality is already
// fine and only the audio is bloating the file. Runs entirely in the browser.

import { fetchFile } from "@ffmpeg/util";
import { loadFFmpeg, setFFmpegProgressHandler, extensionOf } from "../../lib/ffmpeg";

export const AUDIO_BITRATE_OPTIONS = [
  { id: "96k", label: "96 kbps", description: "Ukuran paling kecil, cukup untuk suara bicara." },
  { id: "128k", label: "128 kbps", description: "Seimbang untuk kebanyakan video." },
  { id: "192k", label: "192 kbps", description: "Kualitas lebih baik, penghematan lebih kecil." },
];

/**
 * @param {File} file
 * @param {string} bitrate e.g. "96k"
 * @param {(progress:number)=>void} [onProgress]
 * @returns {Promise<Blob>}
 */
export async function compressAudio(file, bitrate, onProgress) {
  const rate = AUDIO_BITRATE_OPTIONS.some((o) => o.id === bitrate) ? bitrate : "128k";

  onProgress?.(2);
  const ffmpeg = await loadFFmpeg();
  onProgress?.(10);

  const inputName = `input.${extensionOf(file.name) || "mp4"}`;
  const outputName = "output.mp4";

  await ffmpeg.writeFile(inputName, await fetchFile(file));

  const args = [
    "-i",
    inputName,
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-b:a",
    rate,
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
    throw new Error(
      "Gagal mengompres audio. Jika videonya .webm/.mkv, coba dulu tanpa stream copy (mis. lewat tool Kompres Video)."
    );
  }

  onProgress?.(100);
  return new Blob([data.buffer], { type: "video/mp4" });
}
