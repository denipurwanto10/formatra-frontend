import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Search, X, ArrowUpRight, SearchX } from "lucide-react";
import { TOOL_GROUPS, TOOLS, groupOfTool } from "../lib/toolsMeta";
import RecentActivity from "../components/RecentActivity";

const QUICK_ACTION_IDS = [
  "merge-pdf",
  "compress-pdf",
  "word-to-pdf",
  "pdf-to-word",
  "split-pdf",
  "image-to-pdf",
  "pdf-editor",
  "protect-pdf",
];

function toolStyle(tool, i = 0) {
  const group = groupOfTool(tool.id);
  return { "--tool-color": group?.color ?? "var(--ink)", "--i": Math.min(i, 16) };
}

function QuickCard({ tool, index }) {
  const Icon = tool.icon;
  return (
    <Link
      to={`/tools/${tool.id}`}
      style={toolStyle(tool, index)}
      className="stagger-item group relative flex flex-col justify-between gap-6 rounded-[14px] border-hair bg-surface p-4 transition-[border-color,box-shadow,transform] duration-300 ease-[var(--ease-out)] hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-2)] active:translate-y-0 active:scale-[0.99] sm:p-[18px]"
    >
      <div className="flex items-start justify-between">
        <span className="flex size-9 items-center justify-center rounded-[9px] bg-surface-2 text-[var(--tool-color)] transition-transform duration-500 ease-[var(--ease-out)] group-hover:scale-105">
          <Icon className="size-[17px]" strokeWidth={1.7} />
        </span>
        <ArrowUpRight className="size-4 -translate-x-1 translate-y-1 text-muted opacity-0 transition-all duration-300 ease-[var(--ease-out)] group-hover:translate-x-0 group-hover:translate-y-0 group-hover:opacity-100" />
      </div>
      <p className="text-[13.5px] font-medium leading-snug tracking-[-0.01em] text-ink">{tool.short}</p>
    </Link>
  );
}

function ToolRow({ tool, index }) {
  const Icon = tool.icon;
  return (
    <Link
      to={`/tools/${tool.id}`}
      style={toolStyle(tool, index)}
      className="stagger-item group flex items-center gap-3.5 rounded-xl border border-transparent px-3 py-3 transition-[background-color,border-color] duration-200 ease-[var(--ease-out)] hover:border-hair hover:bg-surface active:scale-[0.995]"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-[9px] bg-surface-2 text-[var(--tool-color)] transition-colors duration-200 group-hover:bg-[var(--bg)]">
        <Icon className="size-[17px]" strokeWidth={1.7} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium tracking-[-0.01em] text-ink">{tool.name}</span>
        <span className="mt-0.5 block truncate text-[12.5px] text-muted">{tool.description}</span>
      </span>
      <ArrowUpRight className="size-4 shrink-0 -translate-x-1 text-muted opacity-0 transition-all duration-300 ease-[var(--ease-out)] group-hover:translate-x-0 group-hover:opacity-100" />
    </Link>
  );
}

function matchesQuery(tool, query) {
  return `${tool.name} ${tool.short} ${tool.description}`.toLowerCase().includes(query);
}

export default function Dashboard() {
  const [query, setQuery] = useState("");
  const searchRef = useRef(null);
  const trimmed = query.trim().toLowerCase();
  const isMac = typeof navigator !== "undefined" && /mac/i.test(navigator.platform || "");

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === "Escape" && document.activeElement === searchRef.current) {
        searchRef.current?.blur();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const filteredGroups = useMemo(() => {
    if (!trimmed) return TOOL_GROUPS;
    return TOOL_GROUPS.map((group) => ({
      ...group,
      tools: group.tools.filter((id) => matchesQuery(TOOLS[id], trimmed)),
    })).filter((group) => group.tools.length);
  }, [trimmed]);
  const totalMatches = filteredGroups.reduce((sum, g) => sum + g.tools.length, 0);

  return (
    <div className="page-enter mx-auto w-full max-w-[1160px] px-4 pb-16 pt-7 sm:px-6 sm:pt-10 lg:px-8">
      <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-xl">
          <p className="section-label">Dashboard</p>
          <h1 className="mt-2 text-[1.9rem] font-semibold leading-[1.08] tracking-[-0.04em] text-ink sm:text-[2.4rem]">
            Kerjakan dokumenmu lebih cepat.
          </h1>
          <p className="mt-3 text-[14.5px] leading-relaxed text-muted">
            Konversi, gabungkan, kompres, edit, dan amankan file langsung di browser. Tanpa upload, tanpa antre.
          </p>
        </div>

        <div className="w-full lg:max-w-[360px]">
          <label htmlFor="tool-search" className="sr-only">Cari alat</label>
          <div className="group relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted transition-colors duration-200 group-focus-within:text-ink" />
            <input
              id="tool-search"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari alat…"
              ref={searchRef}
              autoComplete="off"
              aria-keyshortcuts="Control+K Meta+K"
              className="h-12 w-full rounded-xl border-hair bg-surface pl-10 pr-16 text-[14px] text-ink outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-muted/80 focus:border-[var(--ink)] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--ink)_10%,transparent)]"
            />
            {query ? (
              <button
                onClick={() => {
                  setQuery("");
                  searchRef.current?.focus();
                }}
                aria-label="Bersihkan pencarian"
                className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <X className="size-4" />
              </button>
            ) : (
              <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border-hair bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-muted sm:block">
                {isMac ? "⌘ K" : "Ctrl K"}
              </kbd>
            )}
          </div>
        </div>
      </header>

      <div className="mt-10 flex flex-col gap-12">
        {!trimmed && (
          <section aria-labelledby="quick-heading">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 id="quick-heading" className="text-[15px] font-medium tracking-[-0.015em] text-ink">Paling sering dipakai</h2>
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
              {QUICK_ACTION_IDS.map((id, i) => (
                <QuickCard key={id} tool={TOOLS[id]} index={i} />
              ))}
            </div>
          </section>
        )}

        {!trimmed && <RecentActivity />}

        {trimmed && (
          <p className="-mb-6 text-[13px] text-muted" aria-live="polite">
            {totalMatches} alat ditemukan untuk <span className="text-ink">“{query.trim()}”</span>
          </p>
        )}

        {trimmed && totalMatches === 0 && (
          <div className="reveal flex flex-col items-center rounded-2xl border border-dashed border-[var(--border-strong)] px-6 py-14 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-surface-2 text-muted">
              <SearchX className="size-5" strokeWidth={1.6} />
            </span>
            <p className="mt-4 text-[14.5px] font-medium text-ink">Tidak ada alat yang cocok</p>
            <p className="mt-1 max-w-xs text-[13px] text-muted">Coba kata kunci lain, seperti PDF, gambar, compress, atau edit.</p>
          </div>
        )}

        {!trimmed && (
          <div className="-mb-4 flex items-center gap-4">
            <h2 className="text-[15px] font-medium tracking-[-0.015em] text-ink">Semua alat</h2>
            <div className="h-px flex-1 bg-[var(--border)]" />
          </div>
        )}

        {filteredGroups.map((group) => (
          <section key={group.id} aria-labelledby={`g-${group.id}`}>
            <div className="mb-2 flex items-start justify-between gap-4 px-3">
              <div className="min-w-0">
                <h3 id={`g-${group.id}`} className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.07em] text-muted">
                  <span className="size-1.5 shrink-0 rounded-full" style={{ background: group.color }} />
                  {group.label}
                </h3>
                <p className="mt-1.5 text-[13px] leading-snug text-muted/90">{group.blurb}</p>
              </div>
              <span className="shrink-0 pt-0.5 font-mono text-[11.5px] text-muted">{group.tools.length}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 sm:gap-x-2">
              {group.tools.map((toolId, i) => (
                <ToolRow key={toolId} tool={TOOLS[toolId]} index={i} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
