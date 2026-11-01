import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Logo from "../components/ui/Logo";

export default function NotFound() {
  return (
    <div className="page-enter flex min-h-dvh flex-col bg-base px-5 text-ink">
      <header className="mx-auto flex h-16 w-full max-w-[1160px] items-center">
        <Link to="/" aria-label="Formatra — beranda"><Logo /></Link>
      </header>
      <div className="flex flex-1 items-center justify-center pb-24">
        <div className="w-full max-w-md">
          <p className="animate-fade-up font-mono text-[12px] tracking-[0.12em] text-muted">404</p>
          <h1 className="animate-fade-up mt-3 text-[2rem] font-semibold leading-tight tracking-[-0.04em]" style={{ animationDelay: "60ms" }}>
            Halaman tidak ditemukan
          </h1>
          <p className="animate-fade-up mt-3 max-w-sm text-[15px] leading-relaxed text-muted" style={{ animationDelay: "120ms" }}>
            Tautan yang kamu buka mungkin sudah berubah atau tidak tersedia lagi.
          </p>
          <Link
            to="/app"
            style={{ animationDelay: "180ms" }}
            className="animate-fade-up group mt-7 inline-flex h-12 items-center gap-2 rounded-[11px] bg-accent px-5 text-[14.5px] font-medium text-accent-ink transition-[background-color,transform] duration-200 hover:bg-[var(--accent-strong)] active:scale-[0.98]"
          >
            <ArrowLeft className="size-4 transition-transform duration-300 ease-[var(--ease-out)] group-hover:-translate-x-0.5" />
            Kembali ke aplikasi
          </Link>
        </div>
      </div>
    </div>
  );
}
