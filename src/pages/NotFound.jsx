import { Link } from "react-router-dom";
import { ArrowLeft, FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-base px-5 text-ink">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border-hair bg-surface text-accent shadow-soft">
          <FileQuestion className="size-6" />
        </div>
        <p className="mt-5 font-mono text-xs font-medium uppercase tracking-[0.16em] text-muted">404</p>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">Halaman tidak ditemukan</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
          Link yang kamu buka mungkin sudah berubah atau tidak tersedia.
        </p>
        <Link
          to="/app"
          className="mt-6 inline-flex h-11 items-center gap-2 rounded-md bg-accent px-5 text-sm font-semibold text-accent-ink shadow-accent transition-colors hover:bg-[var(--accent-strong)]"
        >
          <ArrowLeft className="size-4" />
          Kembali ke aplikasi
        </Link>
      </div>
    </div>
  );
}
