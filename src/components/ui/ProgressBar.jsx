import { Check } from "lucide-react";

export default function ProgressBar({ value = 0, label, status, indeterminate = false }) {
  const pct = Math.min(100, Math.max(0, value));
  const done = !indeterminate && pct >= 100;

  return (
    <div className="w-full">
      {(label || status) && (
        <div className="mb-2 flex items-center justify-between gap-2 text-[12.5px]">
          <span className="flex items-center gap-1.5 text-muted">
            {done && <Check className="size-3.5 text-[var(--success)]" />}
            {status || label}
          </span>
          {!indeterminate && (
            <span className="font-mono tabular-nums text-muted">{Math.round(pct)}%</span>
          )}
        </div>
      )}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={indeterminate ? undefined : Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        {indeterminate ? (
          <div className="h-full w-1/3 rounded-full bg-accent" style={{ animation: "indeterminate 1.4s var(--ease-in-out) infinite" }} />
        ) : (
          <div className="h-full rounded-full bg-accent transition-[width] duration-500 ease-[var(--ease-out)]" style={{ width: `${pct}%` }} />
        )}
      </div>
    </div>
  );
}
