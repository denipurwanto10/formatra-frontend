import { Link } from "react-router-dom";
import { ChevronRight, LockKeyhole } from "lucide-react";
import { groupOfTool } from "../../lib/toolsMeta";

export default function ToolPageHeader({ tool }) {
  const Icon = tool.icon;
  const group = groupOfTool(tool.id);

  return (
    <header className="mb-7 sm:mb-9">
      <nav className="mb-5 flex items-center gap-1.5 overflow-hidden text-[12px] text-muted" aria-label="Breadcrumb">
        <Link to="/app" className="shrink-0 whitespace-nowrap transition-colors hover:text-ink">Semua alat</Link>
        <ChevronRight className="size-3 shrink-0 text-[var(--border-strong)]" />
        <span className="shrink-0 whitespace-nowrap">{group?.label || "Alat"}</span>
        <ChevronRight className="size-3 shrink-0 text-[var(--border-strong)]" />
        <span className="min-w-0 truncate text-ink">{tool.name}</span>
      </nav>

      <div className="flex items-start gap-4">
        <div
          className="flex size-12 shrink-0 items-center justify-center rounded-[13px] border-hair bg-surface text-[var(--tool-color)] sm:size-14"
          style={{ "--tool-color": group?.color ?? "var(--ink)" }}
        >
          <Icon className="size-[22px] sm:size-6" strokeWidth={1.6} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h1 className="text-[1.6rem] font-semibold leading-tight tracking-[-0.035em] text-ink sm:text-[2rem]">
              {tool.name}
            </h1>
            {tool.accentTag && (
              <span className="rounded-md bg-surface-2 px-2 py-0.5 font-mono text-[10.5px] text-muted">
                {tool.accentTag}
              </span>
            )}
          </div>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-muted sm:text-[14.5px]">
            {tool.description}
          </p>
          <p className="mt-3.5 inline-flex items-center gap-1.5 text-[12px] text-muted">
            <LockKeyhole className="size-3 text-[var(--success)]" /> Diproses di perangkatmu, tidak diunggah
          </p>
        </div>
      </div>
    </header>
  );
}
