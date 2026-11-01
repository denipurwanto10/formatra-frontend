import { AlertTriangle, RotateCcw } from "lucide-react";
import Button from "./Button";

export default function ErrorState({ title = "Terjadi kesalahan", description, onRetry }) {
  return (
    <div role="alert" className="reveal flex flex-col items-center justify-center gap-3 rounded-2xl border border-[color-mix(in_srgb,var(--danger)_28%,transparent)] bg-[var(--danger-bg)] px-6 py-10 text-center">
      <div className="flex size-10 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--danger)_14%,transparent)] text-[var(--danger)]">
        <AlertTriangle className="size-[18px]" />
      </div>
      <div className="space-y-1">
        <p className="text-[14px] font-medium text-ink">{title}</p>
        {description && <p className="max-w-sm text-[13px] text-muted">{description}</p>}
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" icon={RotateCcw} onClick={onRetry}>
          Coba lagi
        </Button>
      )}
    </div>
  );
}
