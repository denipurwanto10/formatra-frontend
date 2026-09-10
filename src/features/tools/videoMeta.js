// Shared helpers used by every browser-side video tool (ffmpeg.wasm runs on
// a single thread with a limited WASM heap, so large files need a heads-up
// before the user commits to a long/blocking operation).

/** Above this size, warn the user the tab may get slow or run out of memory. */
export const LARGE_FILE_WARNING_MB = 200;

/** Reads duration (seconds) from a video file via a throwaway <video> element. */
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

/** Reads duration + natural pixel dimensions in one pass. */
export function readVideoMeta(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const meta = {
        duration: Number.isFinite(video.duration) ? video.duration : 0,
        width: video.videoWidth || 0,
        height: video.videoHeight || 0,
      };
      URL.revokeObjectURL(url);
      resolve(meta);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Gagal membaca metadata video."));
    };
    video.src = url;
  });
}

/** Returns a warning string when `file` is large enough that ffmpeg.wasm
 * (single-threaded, in-browser WASM memory) may be slow or unstable — or
 * null when the file is a comfortable size. */
export function sizeWarning(file) {
  if (!file) return null;
  const mb = file.size / (1024 * 1024);
  if (mb < LARGE_FILE_WARNING_MB) return null;
  return `File ini berukuran ${mb.toFixed(0)}MB. Video besar diproses di dalam browser (ffmpeg.wasm) dan bisa berjalan lambat atau membuat tab tidak responsif karena keterbatasan memori WASM — pertimbangkan memotong durasinya dulu, atau proses dari perangkat dengan RAM lebih besar.`;
}

/**
 * Very rough wall-clock estimate for how long an operation will take,
 * expressed as a multiple of the clip's own duration. These are heuristics
 * (single-threaded veryfast x264 in WASM on typical laptop hardware), not a
 * guarantee — used purely to set expectations before a long-running task.
 *
 * speedFactor: seconds of processing per second of source video
 *   - "copy"   ~0.15  (stream copy / audio-only, no video re-encode)
 *   - "encode" ~1.1   (typical single-pass H.264 re-encode)
 *   - "heavy"  ~1.8   (two-pass / palette-based work, e.g. GIF export)
 */
export function estimateSeconds(durationSec, speedFactor = 1.1) {
  const d = Number(durationSec) || 0;
  if (d <= 0) return 0;
  // Small constant overhead for loading the ffmpeg core itself.
  return Math.max(3, Math.round(d * speedFactor + 3));
}

export function formatEstimate(seconds) {
  const s = Math.max(0, Math.round(seconds));
  if (s < 45) return "sekitar setengah menit";
  const minutes = Math.round(s / 60);
  if (minutes <= 1) return "sekitar 1 menit";
  if (minutes < 60) return `sekitar ${minutes} menit`;
  const hours = (minutes / 60).toFixed(1);
  return `sekitar ${hours} jam`;
}
