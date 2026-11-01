// Lazily loads a single shared ffmpeg.wasm instance for all video tools.
// The core (JS glue + .wasm binary) is fairly large (~30MB), so it's fetched
// from a CDN on first use and cached in memory for the rest of the session —
// nothing is ever uploaded, the video itself never leaves the browser.

let ffmpegInstance = null;
let loadingPromise = null;
let progressHandler = null;

const CORE_VERSION = "0.12.6";
const CORE_BASE = `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/esm`;

export async function loadFFmpeg() {
  if (ffmpegInstance) return ffmpegInstance;
  if (!loadingPromise) {
    loadingPromise = (async () => {
      const [{ FFmpeg }, { toBlobURL }] = await Promise.all([
        import("@ffmpeg/ffmpeg"),
        import("@ffmpeg/util"),
      ]);
      const ffmpeg = new FFmpeg();
      ffmpeg.on("progress", ({ progress }) => {
        if (progressHandler && Number.isFinite(progress)) {
          progressHandler(Math.min(1, Math.max(0, progress)));
        }
      });
      const [coreURL, wasmURL] = await Promise.all([
        toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
        toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, "application/wasm"),
      ]);
      await ffmpeg.load({ coreURL, wasmURL });
      ffmpegInstance = ffmpeg;
      return ffmpeg;
    })().catch((err) => {
      loadingPromise = null; // allow retry on next call
      throw err;
    });
  }
  return loadingPromise;
}

/** Register a single (progress: 0-1) => void callback for the currently
 * running ffmpeg.exec() call. Pass null when done to avoid stray updates
 * leaking into the next task. */
export function setFFmpegProgressHandler(fn) {
  progressHandler = fn;
}

export function extensionOf(filename) {
  const match = /\.([a-z0-9]+)$/i.exec(filename || "");
  return match ? match[1].toLowerCase() : "";
}
