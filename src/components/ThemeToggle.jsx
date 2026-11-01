import { Moon, Sun } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? "Aktifkan mode terang" : "Aktifkan mode gelap"}
      className="tap-target relative flex size-9 items-center justify-center overflow-hidden rounded-lg text-muted transition-colors duration-200 hover:bg-surface-2 hover:text-ink"
    >
      <Sun className={`absolute size-[17px] transition-all duration-500 ease-[var(--ease-out)] ${isDark ? "rotate-0 scale-100 opacity-100" : "rotate-90 scale-50 opacity-0"}`} />
      <Moon className={`absolute size-[17px] transition-all duration-500 ease-[var(--ease-out)] ${isDark ? "-rotate-90 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100"}`} />
    </button>
  );
}
