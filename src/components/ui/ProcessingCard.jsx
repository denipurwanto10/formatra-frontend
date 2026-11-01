import { FileText } from "lucide-react";
import { formatBytes } from "../../utils/formatBytes";

/**
 * "In progress" card shown while a tool works on a file.
 * @param {File} file
 * @param {number} progress 0-100
 * @param {string} [label] status text
 * @param {() => void} [onCancel] omit to hide the Batal button
 */
export default function ProcessingCard({ file, progress = 0, label = "Memproses...", onCancel }) {
  const pct = Math.min(100, Math.max(0, Math.round(progress)));
  const statusText = pct >= 100 ? "Menyelesaikan..." : label;

  return (
    <div aria-live="polite" aria-busy={pct < 100} className="reveal surface-elevated flex flex-col gap-5 rounded-[16px] p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-surface-2 text-ink">
          <FileText className="size-[18px]" strokeWidth={1.7} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-medium text-ink">{file?.name}</p>
          <p className="font-mono text-[11.5px] text-muted">{formatBytes(file?.size)}</p>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="tap-target shrink-0 rounded-lg px-3 text-[13px] font-medium text-muted transition-colors hover:bg-[var(--danger-bg)] hover:text-[var(--danger)]"
          >
            Batal
          </button>
        )}
      </div>

      <div className="w-full">
        <div className="mb-2 flex items-center justify-between gap-2 text-[12.5px]">
          <span className="text-muted">{statusText}</span>
          <span className="font-mono tabular-nums text-ink">{pct}%</span>
        </div>
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="relative h-full overflow-hidden rounded-full bg-accent transition-[width] duration-500 ease-[var(--ease-out)]" style={{ width: `${pct}%` }}>
            {pct < 100 && (
              <span className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent" style={{ animation: "bar-sheen 1.6s var(--ease-in-out) infinite" }} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
