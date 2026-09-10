import { FileText, Loader2 } from "lucide-react";
import { formatBytes } from "../../utils/formatBytes";

/**
 * Rich "in progress" card shown while a tool is actively working on a file.
 * Replaces a bare progress bar with something that reads as informative and
 * intentional: file identity (icon, name, size), live percentage, a status
 * line, and — when the caller passes `onCancel` — a way out.
 *
 * @param {File} file
 * @param {number} progress 0-100
 * @param {string} [label] status text, e.g. "Mengompres file..."
 * @param {() => void} [onCancel] omit to hide the Batal button entirely
 */
export default function ProcessingCard({ file, progress = 0, label = "Memproses...", onCancel }) {
  const pct = Math.min(100, Math.max(0, Math.round(progress)));
  const statusText = pct >= 100 ? "Menyelesaikan..." : label;

  return (
    <div aria-live="polite" aria-busy={pct < 100} className="reveal surface-elevated flex flex-col gap-4 rounded-[var(--radius-md)] p-4.5 transition-shadow duration-200 hover:shadow-soft-lg">
      <div className="flex items-center gap-3">
        <div className="relative flex size-11 shrink-0 items-center justify-center rounded-xl border border-accent/15 bg-accent/10 text-accent">
          <FileText className="size-5" />
          <span className="absolute -bottom-1 -right-1 flex size-4 items-center justify-center rounded-full bg-accent text-accent-ink shadow-sm ring-2 ring-surface">
            <Loader2 className="size-2.5 animate-spin" />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-medium text-ink">{file?.name}</p>
          <p className="font-mono text-[11px] text-muted">{formatBytes(file?.size)}</p>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="shrink-0 rounded-lg border-hair px-3 py-1.5 text-[12.5px] font-medium text-muted transition-colors hover:border-[var(--danger)]/50 hover:bg-[var(--danger-bg)] hover:text-[var(--danger)]"
          >
            Batal
          </button>
        )}
      </div>

      <div className="w-full">
        <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
          <span className="text-muted">{statusText}</span>
          <span className="font-mono tabular-nums text-ink">{pct}%</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-2 ring-1 ring-inset ring-black/5 dark:ring-white/5">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-200 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
