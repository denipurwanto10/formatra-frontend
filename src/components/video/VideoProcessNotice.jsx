import { AlertTriangle, Timer } from "lucide-react";
import { sizeWarning, estimateSeconds, formatEstimate } from "../../features/tools/videoMeta";

/**
 * Inline notice shown once a video file + its duration are known: a soft
 * warning for large files (ffmpeg.wasm is single-threaded and can stall or
 * crash the tab on big inputs) plus a rough processing-time estimate so the
 * user isn't left guessing whether the tool is stuck.
 *
 * @param {File} file
 * @param {number} durationSec
 * @param {"copy"|"encode"|"heavy"} [speed] see videoMeta.estimateSeconds
 */
export default function VideoProcessNotice({ file, durationSec, speed = "encode" }) {
  const factor = speed === "copy" ? 0.15 : speed === "heavy" ? 1.8 : 1.1;
  const warning = sizeWarning(file);
  const estimate = durationSec > 0 ? formatEstimate(estimateSeconds(durationSec, factor)) : null;

  if (!warning && !estimate) return null;

  return (
    <div className="flex flex-col gap-2">
      {warning && (
        <div className="flex items-start gap-2 rounded-md border border-[var(--warning,#F59E0B)]/30 bg-[var(--warning-bg,rgba(245,158,11,0.1))] px-3 py-2 text-[12.5px] text-ink">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-[var(--warning,#F59E0B)]" />
          <span>{warning}</span>
        </div>
      )}
      {estimate && (
        <p className="flex items-center gap-1.5 text-[12px] text-muted">
          <Timer className="size-3.5 shrink-0" />
          Estimasi waktu proses: {estimate} (tergantung perangkat, bisa berbeda).
        </p>
      )}
    </div>
  );
}
