import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Search, X, ArrowRight, Flame, Sparkles, ShieldCheck } from "lucide-react";
import { TOOL_GROUPS, TOOLS, groupOfTool } from "../lib/toolsMeta";
import RecentActivity from "../components/RecentActivity";

const QUICK_ACTION_IDS = ["merge-pdf", "compress-pdf", "word-to-pdf", "pdf-to-word", "split-pdf", "image-to-pdf"];
const POPULAR_TOOL_IDS = ["merge-pdf", "compress-pdf", "word-to-pdf", "pdf-to-word", "split-pdf", "image-to-pdf", "pdf-editor", "protect-pdf"];

function ToolCard({ tool }) {
  const Icon = tool.icon;
  const group = groupOfTool(tool.id);
  return (
    <Link to={`/tools/${tool.id}`} style={{ "--tool-color": group?.color ?? "var(--accent)", "--tool-color-bg": group?.colorBg }} className="group flex items-center gap-3.5 rounded-[18px] border-hair bg-surface p-4 interactive-surface transition-all duration-200 hover:border-[var(--tool-color)]/25 hover:shadow-soft">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-[14px] bg-[var(--tool-color-bg)] text-[var(--tool-color)] transition-all group-hover:scale-105 group-hover:bg-[var(--tool-color)] group-hover:text-[var(--accent-ink)]"><Icon className="size-[18px]" /></div>
      <div className="min-w-0 flex-1"><p className="text-[13.5px] font-semibold text-ink">{tool.name}</p><p className="mt-0.5 truncate text-[12.5px] leading-snug text-muted">{tool.description}</p></div>
      <ArrowRight className="size-4 shrink-0 -translate-x-1 text-muted opacity-0 transition-all group-hover:translate-x-0 group-hover:text-[var(--tool-color)] group-hover:opacity-100" />
    </Link>
  );
}

function QuickActionButton({ tool }) {
  const Icon = tool.icon;
  const group = groupOfTool(tool.id);
  return <Link to={`/tools/${tool.id}`} style={{ "--tool-color": group?.color ?? "var(--accent)", "--tool-color-bg": group?.colorBg }} className="group flex items-center gap-2.5 rounded-[16px] border-hair bg-surface p-3 interactive-surface transition-all duration-200 hover:border-accent/25 hover:shadow-soft sm:flex-col sm:gap-2 sm:p-4 sm:text-center"><div className="flex size-10 shrink-0 items-center justify-center rounded-[13px] bg-[var(--tool-color-bg)] text-[var(--tool-color)] transition-all group-hover:bg-[var(--tool-color)] group-hover:text-[var(--accent-ink)]"><Icon className="size-[18px]" /></div><p className="text-[12.5px] font-semibold leading-tight text-ink">{tool.short}</p></Link>;
}

function matchesQuery(tool, query) { return `${tool.name} ${tool.short} ${tool.description}`.toLowerCase().includes(query); }

export default function Dashboard() {
  const [query, setQuery] = useState("");
  const searchRef = useRef(null);
  const trimmed = query.trim().toLowerCase();

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
    return TOOL_GROUPS.map((group) => ({ ...group, tools: group.tools.filter((id) => matchesQuery(TOOLS[id], trimmed)) })).filter((group) => group.tools.length);
  }, [trimmed]);
  const totalMatches = filteredGroups.reduce((sum, g) => sum + g.tools.length, 0);

  return (
    <div className="mx-auto max-w-[1180px] px-5 py-7 sm:py-9 lg:px-8">
      <section className="relative overflow-hidden rounded-[26px] border-hair bg-surface p-6 shadow-soft sm:p-8 lg:p-9">
        <div className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full bg-accent/8 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-success-bg px-2.5 py-1 text-[11px] font-semibold text-[var(--success)]"><ShieldCheck className="size-3.5" /> File tetap lokal</div>
            <h1 className="font-display text-[1.8rem] font-semibold leading-tight tracking-tight text-ink sm:text-[2.15rem]">Kerjakan dokumenmu lebih cepat.</h1>
            <p className="mt-2.5 max-w-xl text-[13.5px] leading-relaxed text-muted sm:text-[14px]">Konversi, gabungkan, kompres, edit, dan amankan file langsung di browser. Tidak perlu upload, tidak perlu antre.</p>
          </div>
          <div className="w-full lg:max-w-sm">
            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Cari alat</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Mis. compress, watermark..." ref={searchRef} aria-keyshortcuts="Control+K Meta+K" className="h-11 w-full rounded-[14px] border-hair bg-base pl-11 pr-10 text-[13px] text-ink outline-none transition-all placeholder:text-muted/70 focus:border-accent/50 focus:ring-4 focus:ring-accent/10" />
              {query && <button onClick={() => setQuery("")} aria-label="Bersihkan pencarian" className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-muted hover:bg-surface-2 hover:text-ink"><X className="size-4" /></button>}
            </div>
          </div>
        </div>
      </section>

      <div className="mt-9 flex flex-col gap-9">
        {!trimmed && <section><div className="mb-3 flex items-center justify-between"><h2 className="text-[13px] font-semibold text-ink">Mulai dari sini</h2><span className="text-[11px] text-muted">Paling sering digunakan</span></div><div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">{QUICK_ACTION_IDS.map((id) => <QuickActionButton key={id} tool={TOOLS[id]} />)}</div></section>}
        {!trimmed && <section><h2 className="mb-3 flex items-center gap-1.5 text-[13px] font-semibold text-ink"><Flame className="size-[15px] text-[var(--coral)]" /> Alat populer</h2><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{POPULAR_TOOL_IDS.map((id) => { const t=TOOLS[id], I=t.icon, g=groupOfTool(id); return <Link key={id} to={`/tools/${id}`} style={{"--tool-color":g?.color}} className="group flex items-center gap-2 rounded-[14px] border-hair bg-surface px-3 py-2.5 transition-all hover:border-[var(--tool-color)]/30 hover:bg-surface-2"><span className="flex size-7 items-center justify-center rounded-lg bg-[var(--tool-color)]/10 text-[var(--tool-color)]"><I className="size-3.5" /></span><span className="truncate text-[12.5px] font-semibold text-ink">{t.short}</span></Link> })}</div></section>}
        {!trimmed && <RecentActivity />}
        {trimmed && totalMatches === 0 && <div className="rounded-[18px] border-hair bg-surface p-8 text-center"><Sparkles className="mx-auto size-5 text-accent" /><p className="mt-2 text-[13.5px] font-medium text-ink">Tidak ada tool yang cocok.</p><p className="mt-1 text-[12.5px] text-muted">Coba kata kunci lain seperti PDF, image, compress, atau edit.</p></div>}
        {!trimmed && <div className="flex items-center gap-3"><h2 className="text-[13px] font-semibold text-ink">Semua alat</h2><div className="h-px flex-1 bg-[var(--border)]" /></div>}
        {filteredGroups.map((group) => <section key={group.id}><div className="mb-3 flex min-w-0 items-start justify-between gap-3"><div className="min-w-0 flex-1"><h2 className="flex min-w-0 items-center gap-2 text-[13px] font-semibold text-ink"><span className="size-1.5 shrink-0 rounded-full" style={{ background: group.color }} />{group.label}</h2><p className="mt-1 max-w-full text-[11.5px] leading-snug text-muted">{group.blurb}</p></div><span className="shrink-0 whitespace-nowrap rounded-md bg-surface-2 px-2 py-1 text-[10.5px] font-mono text-muted">{group.tools.length} alat</span></div><div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">{group.tools.map((toolId) => <ToolCard key={toolId} tool={TOOLS[toolId]} />)}</div></section>)}
      </div>
    </div>
  );
}
