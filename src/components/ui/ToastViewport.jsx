import { CheckCircle2, AlertCircle, Info, X, TriangleAlert } from "lucide-react";
import { useToastList } from "../../context/ToastContext";
import clsx from "clsx";

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: TriangleAlert,
  info: Info,
};

const ICON_COLOR = {
  success: "text-[var(--success)]",
  error: "text-[var(--danger)]",
  warning: "text-[var(--warning)]",
  info: "text-accent",
};

export default function ToastViewport() {
  const { toasts, dismiss } = useToastList();

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
      {toasts.map((t) => {
        const Icon = ICONS[t.variant] || Info;
        return (
          <div
            key={t.id}
            className="animate-toast-in pointer-events-auto flex items-start gap-2.5 rounded-xl border-hair bg-surface px-3.5 py-3 shadow-soft"
          >
            <Icon className={clsx("mt-0.5 size-4 shrink-0", ICON_COLOR[t.variant])} />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium leading-snug text-ink">{t.title}</p>
              {t.description && (
                <p className="mt-0.5 text-[12.5px] leading-snug text-muted">
                  {t.description}
                </p>
              )}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="shrink-0 rounded p-0.5 text-muted hover:bg-surface-2 hover:text-ink"
              aria-label="Tutup notifikasi"
            >
              <X className="size-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
