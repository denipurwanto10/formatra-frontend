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
  info: "text-muted",
};

export default function ToastViewport() {
  const { toasts, dismiss } = useToastList();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[300] flex flex-col gap-2 sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[380px]"
    >
      {toasts.map((t) => {
        const Icon = ICONS[t.variant] || Info;
        return (
          <div
            key={t.id}
            role={t.variant === "error" ? "alert" : "status"}
            className={clsx(
              "pointer-events-auto flex items-start gap-3 rounded-[14px] border-hair bg-surface px-3.5 py-3 shadow-soft-lg",
              t.leaving ? "animate-toast-out" : "animate-toast-in"
            )}
          >
            <Icon className={clsx("mt-[1px] size-4 shrink-0", ICON_COLOR[t.variant])} />
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-medium leading-snug text-ink">{t.title}</p>
              {t.description && (
                <p className="mt-0.5 text-[12.5px] leading-snug text-muted">{t.description}</p>
              )}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="-mr-1 -mt-0.5 shrink-0 rounded-md p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-ink"
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
