import { Menu, X, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import ThemeToggle from "../ThemeToggle";
import { LogoMark } from "../ui/Logo";

export default function Topbar({ title, onMenuClick, menuOpen = false }) {
  return (
    <header className="z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-hair bg-[color-mix(in_srgb,var(--bg)_82%,transparent)] px-3 backdrop-blur-md sm:px-5">
      <div className="flex min-w-0 items-center gap-1.5">
        <button
          onClick={onMenuClick}
          aria-expanded={menuOpen}
          className="tap-target relative -ml-1 flex size-9 shrink-0 items-center justify-center rounded-lg text-ink transition-colors hover:bg-surface-2 active:bg-surface-2 lg:hidden"
          aria-label={menuOpen ? "Tutup navigasi" : "Buka navigasi"}
        >
          <Menu className={`absolute size-5 transition-all duration-300 ease-[var(--ease-out)] ${menuOpen ? "rotate-90 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100"}`} />
          <X className={`absolute size-5 transition-all duration-300 ease-[var(--ease-out)] ${menuOpen ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-50 opacity-0"}`} />
        </button>
        <Link to="/" className="hidden items-center gap-2 text-[13px] text-muted transition-colors hover:text-ink sm:flex" aria-label="Kembali ke beranda">
          <LogoMark className="size-5 rounded-[6px] lg:hidden" />
          <span className="hidden lg:inline">Formatra</span>
        </Link>
        <ChevronRight className="hidden size-3.5 text-[var(--border-strong)] sm:block" />
        <h1 className="truncate text-[14px] font-medium tracking-[-0.01em] text-ink">{title}</h1>
      </div>
      <div className="flex items-center gap-1">
        <ThemeToggle />
      </div>
    </header>
  );
}
