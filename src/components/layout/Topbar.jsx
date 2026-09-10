import { Menu, X, ChevronRight } from "lucide-react";
import ThemeToggle from "../ThemeToggle";

export default function Topbar({ title, onMenuClick, menuOpen = false }) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-hair bg-base px-4">
      <div className="flex min-w-0 items-center gap-2">
        <button
          onClick={onMenuClick}
          aria-expanded={menuOpen}
          className="tap-target relative flex size-9 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-ink active:bg-surface-2 lg:hidden"
          aria-label={menuOpen ? "Tutup navigasi" : "Buka navigasi"}
        >
          <Menu
            className={`absolute size-5 transition-all duration-200 ${
              menuOpen ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"
            }`}
          />
          <X
            className={`absolute size-5 transition-all duration-200 ${
              menuOpen ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0"
            }`}
          />
        </button>
        <div className="flex min-w-0 items-center gap-1.5"><span className="hidden text-[12px] font-medium text-muted sm:inline">Formatra</span><ChevronRight className="hidden size-3 text-muted/60 sm:inline" /><h1 className="truncate text-[14px] font-semibold text-ink">{title}</h1></div>
      </div>
      <div className="flex items-center gap-1">
        <ThemeToggle />
      </div>
    </header>
  );
}
