import { Link } from "react-router-dom";
import { ChevronRight, LockKeyhole, Sparkles } from "lucide-react";
import { groupOfTool } from "../../lib/toolsMeta";

export default function ToolPageHeader({ tool }) {
  const Icon = tool.icon;
  const group = groupOfTool(tool.id);

  return (
    <header className="mb-8">
      <nav className="mb-5 flex items-center gap-1.5 overflow-hidden text-[11px] font-semibold uppercase tracking-[0.08em] text-muted" aria-label="Breadcrumb">
        <Link to="/app" className="shrink-0 whitespace-nowrap transition-colors hover:text-ink">Semua alat</Link>
        <ChevronRight className="size-3 shrink-0" />
        <span className="shrink-0 whitespace-nowrap">{group?.label || "Tool"}</span>
        <ChevronRight className="size-3 shrink-0" />
        <span className="min-w-0 truncate text-ink">{tool.name}</span>
      </nav>

      <div className="flex items-start gap-4">
        <div
          className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-[var(--tool-color)]/15 bg-[var(--tool-color-bg)] text-[var(--tool-color)] shadow-soft"
          style={{ "--tool-color": group?.color ?? "var(--accent)", "--tool-color-bg": group?.colorBg ?? "color-mix(in srgb, var(--accent) 12%, transparent)" }}
        >
          <Icon className="size-6.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-[-0.025em] text-ink sm:text-[2.05rem]">
              {tool.name}
            </h1>
            {tool.accentTag && (
              <span className="rounded-full bg-surface-2 px-2.5 py-1 font-mono text-[10px] font-medium text-muted">
                {tool.accentTag}
              </span>
            )}
          </div>
          <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-muted sm:text-[14px]">
            {tool.description}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border-hair bg-surface px-2.5 py-1 text-[11px] font-medium text-muted">
              <LockKeyhole className="size-3 text-[var(--success)]" /> Diproses di perangkat
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border-hair bg-surface px-2.5 py-1 text-[11px] font-medium text-muted">
              <Sparkles className="size-3 text-accent" /> Cepat
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
