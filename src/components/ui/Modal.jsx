import { useEffect } from "react";
import { X } from "lucide-react";
import { createPortal } from "react-dom";

export default function Modal({ open, onClose, title, children, width = 420 }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative flex max-h-[90vh] w-full flex-col overflow-y-auto rounded-2xl border-hair bg-surface p-5 shadow-soft-lg"
        style={{ maxWidth: width }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted hover:bg-surface-2 hover:text-ink"
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
