// Client-side "extract audio" via ffmpeg.wasm: drops the video stream
// entirely (-vn) and re-encodes just the audio, so this is fast regardless
// of how long or heavy the source video is. Runs entirely in the browser.

import { fetchFile } from "@ffmpeg/util";
import { loadFFmpeg, setFFmpegProgressHandler, extensionOf } from "../../lib/ffmpeg";

export const AUDIO_FORMATS = [
  { id: "mp3", label: "MP3", ext: "mp3", mime: "audio/mpeg" },
  { id: "aac", label: "AAC (.m4a)", ext: "m4a", mime: "audio/mp4" },
];

export const AUDIO_BITRATES = ["96k", "128k", "192k", "256k", "320k"];

/**
 * @param {File} file
 * @param {{format?:"mp3"|"aac", bitrate?:string}} options
 * @param {(progress:number)=>void} [onProgress]
 * @returns {Promise<Blob>}
 */
export async function extractAudio(file, options, onProgress) {
  const { format = "mp3", bitrate = "192k" } = options || {};
  const fmt = AUDIO_FORMATS.find((f) => f.id === format) || AUDIO_FORMATS[0];

  onProgress?.(2);
  const ffmpeg = await loadFFmpeg();
  onProgress?.(10);

  const inputName = `input.${extensionOf(file.name) || "mp4"}`;
  const outputName = `output.${fmt.ext}`;

  await ffmpeg.writeFile(inputName, await fetchFile(file));

  const args = ["-i", inputName, "-vn"];
  if (fmt.id === "mp3") {
    args.push("-c:a", "libmp3lame", "-b:a", bitrate);
  } else {
    args.push("-c:a", "aac", "-b:a", bitrate);
  }
  args.push(outputName);

  setFFmpegProgressHandler((p) => onProgress?.(10 + Math.round(p * 88)));
  try {
    await ffmpeg.exec(args);
  } finally {
    setFFmpegProgressHandler(null);
  }

  const data = await ffmpeg.readFile(outputName);
  await Promise.allSettled([ffmpeg.deleteFile(inputName), ffmpeg.deleteFile(outputName)]);

  if (!data || !data.length) {
    throw new Error("Gagal mengekstrak audio. Video ini mungkin tidak punya trek audio.");
  }

  onProgress?.(100);
  return new Blob([data.buffer], { type: fmt.mime });
}
