import { Check } from "lucide-react";

export default function ProgressBar({ value = 0, label, status, indeterminate = false }) {
  const pct = Math.min(100, Math.max(0, value));
  const done = !indeterminate && pct >= 100;

  return (
    <div className="w-full">
      {(label || status) && (
        <div className="mb-2 flex items-center justify-between gap-2 text-xs">
          <span className="flex items-center gap-1.5 text-muted">
            {done && <Check className="size-3.5 text-[var(--success)]" />}
            {status || label}
          </span>
          {!indeterminate && (
            <span className="font-mono tabular-nums text-muted">{Math.round(pct)}%</span>
          )}
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
        {indeterminate ? (
          <div className="h-full w-1/3 animate-[indeterminate_1.1s_ease-in-out_infinite] rounded-full bg-accent" />
        ) : (
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-200 ease-out"
            style={{ width: `${pct}%` }}
          />
        )}
      </div>
      <style>{`
        @keyframes indeterminate {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(150%); }
          100% { transform: translateX(150%); }
        }
      `}</style>
    </div>
  );
}
