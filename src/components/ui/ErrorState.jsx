import { AlertTriangle, RotateCcw } from "lucide-react";
import Button from "./Button";

export default function ErrorState({ title = "Terjadi kesalahan", description, onRetry }) {
  return (
    <div className="reveal flex flex-col items-center justify-center gap-3 rounded-2xl border border-[var(--danger)]/30 bg-[var(--danger-bg)] px-6 py-10 text-center">
      <div className="flex size-11 items-center justify-center rounded-full bg-[var(--danger-bg)] text-[var(--danger)]">
        <AlertTriangle className="size-5" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-ink">{title}</p>
        {description && (
          <p className="max-w-sm text-[13px] text-muted">{description}</p>
        )}
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" icon={RotateCcw} onClick={onRetry}>
          Coba lagi
        </Button>
      )}
    </div>
  );
}
