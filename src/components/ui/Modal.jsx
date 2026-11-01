import { useEffect } from "react";
import { X } from "lucide-react";
import { createPortal } from "react-dom";
import { usePresence } from "../../hooks/usePresence";

export default function Modal({ open, onClose, title, children, width = 420 }) {
  const { mounted, visible } = usePresence(open, 280);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!mounted) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mounted]);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center sm:p-6">
      <div
        data-open={visible}
        className="fade-presence absolute inset-0 bg-[color-mix(in_srgb,var(--ink)_42%,transparent)] backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-open={visible}
        className="modal-presence shadow-soft-lg relative flex max-h-[92dvh] w-full flex-col overflow-y-auto rounded-t-[20px] border-hair bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:max-h-[90dvh] sm:rounded-[18px] sm:p-6"
        style={{ maxWidth: width }}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="min-w-0 truncate text-[15px] font-semibold text-ink">{title}</h2>
          <button
            onClick={onClose}
            className="tap-target -mr-2 flex shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink"
            aria-label="Tutup"
          >
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
