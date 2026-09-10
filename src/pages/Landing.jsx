import { Link } from "react-router-dom";
import {
  FileStack,
  ShieldCheck,
  Zap,
  Globe,
  ChevronDown,
  ChevronUp,
  Menu,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { TOOL_GROUPS, TOOLS, TOOL_LIST, groupOfTool } from "../lib/toolsMeta";
import ThemeToggle from "../components/ThemeToggle";

const NAV_DIRECT = ["merge-pdf", "split-pdf", "compress-pdf"];

const FEATURES = [
  {
    icon: ShieldCheck,
    title: "Privat",
    desc: "File diproses langsung di perangkat Anda, tidak pernah diunggah ke server mana pun.",
  },
  {
    icon: Zap,
    title: "Cepat",
    desc: "Tanpa antre upload/download — hasil langsung tersedia begitu proses selesai di browser.",
  },
  {
    icon: FileStack,
    title: "Tanpa Instalasi",
    desc: "Tidak perlu unduh atau pasang aplikasi apa pun, langsung pakai di browser.",
  },
  {
    icon: Globe,
    title: "Berbasis browser",
    desc: "Berjalan di Chrome, Edge, Firefox, atau Safari modern — desktop maupun mobile.",
  },
];

function NavDropdown({ label, groupId }) {
  const [open, setOpen] = useState(false);
  const group = TOOL_GROUPS.find((g) => g.id === groupId);

  return (
    <div className="relative" onMouseLeave={() => setOpen(false)}>
      <button
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setOpen(true)}
        className="flex items-center gap-1 text-[13.5px] font-medium text-ink/80 transition-colors hover:text-ink"
        aria-expanded={open}
      >
        {label}
        <ChevronDown className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute left-1/2 top-full z-30 w-56 -translate-x-1/2 pt-3">
          <div className="rounded-xl border-hair bg-surface p-1.5 shadow-soft-lg">
            {group.tools.map((id) => (
              <Link
                key={id}
                to={`/tools/${id}`}
                className="block rounded-lg px-3 py-2 text-[13px] text-ink hover:bg-surface-2"
              >
                {TOOLS[id].name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ToolGridCard({ tool }) {
  const Icon = tool.icon;
  const group = groupOfTool(tool.id);
  return (
    <Link
      to={`/tools/${tool.id}`}
      style={{ "--tool-color": group?.color ?? "var(--accent)", "--tool-color-bg": group?.colorBg }}
      className="group flex flex-col gap-4 rounded-[20px] border-hair bg-surface p-5 interactive-surface transition-all duration-200 hover:border-accent/20 hover:shadow-soft"
    >
      <div className="flex size-11 items-center justify-center rounded-2xl bg-[var(--tool-color-bg)] text-[var(--tool-color)] transition-colors duration-200 group-hover:bg-[var(--tool-color)] group-hover:text-[var(--accent-ink)]">
        <Icon className="size-5" />
      </div>
      <div>
        <p className="text-[14.5px] font-semibold text-ink">{tool.name}</p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{tool.description}</p>
      </div>
    </Link>
  );
}

export default function Landing() {
  const [activeGroup, setActiveGroup] = useState("all");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 400);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const visibleTools =
    activeGroup === "all"
      ? TOOL_LIST
      : TOOL_GROUPS.find((g) => g.id === activeGroup).tools.map((id) => TOOLS[id]);

  return (
    <div className="min-h-screen bg-base text-ink">
      <div className="h-[3px] bg-accent" />
      <header className="sticky top-0 z-40 border-b border-hair bg-base/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 lg:px-8">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="relative flex size-8 items-center justify-center rounded-xl bg-accent text-accent-ink shadow-soft">
              <FileStack className="size-[18px]" />
              <span className="absolute -right-1 -top-1 size-2.5 rounded-full bg-[var(--coral)]" aria-hidden="true" />
            </div>
            <span className="font-display text-[17px] font-semibold tracking-tight">Formatra</span>
          </Link>

          <nav className="hidden items-center gap-7 lg:flex">
            {NAV_DIRECT.map((id) => (
              <Link
                key={id}
                to={`/tools/${id}`}
                className="text-[13.5px] font-medium text-ink/80 transition-colors hover:text-ink"
              >
                {TOOLS[id].name}
              </Link>
            ))}
            <NavDropdown label="Konversi" groupId="convert" />
            <NavDropdown label="Keamanan" groupId="optimize" />
            <Link
              to="/app"
              className="text-[13.5px] font-medium text-ink/80 transition-colors hover:text-ink"
            >
              Semua alat
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              to="/app"
              className="hidden rounded-md bg-accent px-4 py-2 text-[13px] font-medium text-accent-ink transition-colors hover:bg-[var(--accent-strong)] sm:inline-flex"
            >
              Buka aplikasi
            </Link>
            <button
              onClick={() => setMobileOpen((o) => !o)}
              aria-expanded={mobileOpen}
              className="relative flex size-9 items-center justify-center text-ink transition-colors hover:bg-surface-2 rounded-md active:bg-surface-2 lg:hidden"
              aria-label={mobileOpen ? "Tutup menu" : "Buka menu"}
            >
              <Menu
                className={`absolute size-5 transition-all duration-200 ${
                  mobileOpen ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"
                }`}
              />
              <X
                className={`absolute size-5 transition-all duration-200 ${
                  mobileOpen ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0"
                }`}
              />
            </button>
          </div>
        </div>

        <div
          className={`grid overflow-hidden border-hair transition-[grid-template-rows,opacity,border-color] duration-300 ease-out lg:hidden ${
            mobileOpen ? "grid-rows-[1fr] border-t opacity-100" : "grid-rows-[0fr] border-t-0 opacity-0"
          }`}
        >
          <div className="min-h-0 px-5 py-3">
            <div className="flex flex-col gap-0.5">
              {TOOL_GROUPS.flatMap((g) => g.tools)
                .slice(0, 8)
                .map((id) => (
                  <Link
                    key={id}
                    to={`/tools/${id}`}
                    onClick={() => setMobileOpen(false)}
                    className="rounded px-2 py-2.5 text-[13.5px] font-medium text-ink transition-colors active:bg-surface-2 hover:bg-surface-2"
                  >
                    {TOOLS[id].name}
                  </Link>
                ))}
              <Link
                to="/app"
                onClick={() => setMobileOpen(false)}
                className="mt-1 rounded bg-accent px-2 py-2.5 text-center text-[13.5px] font-medium text-accent-ink transition-transform active:scale-[0.98]"
              >
                Buka aplikasi
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden px-5 pb-12 pt-14 lg:pb-16 lg:pt-20">
        <div className="pointer-events-none absolute left-1/2 top-[-140px] -z-10 h-[460px] w-[760px] -translate-x-1/2 rounded-full bg-accent/10 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute right-[8%] top-20 -z-10 size-40 rounded-full bg-[var(--coral)]/10 blur-3xl" aria-hidden="true" />
        <div className="mx-auto max-w-4xl text-center">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border-hair bg-surface px-3 py-1.5 text-[11.5px] font-semibold text-muted shadow-soft">
            <span className="size-1.5 rounded-full bg-[var(--success)]" /> Semua proses berjalan di perangkatmu
          </div>
          <h1 className="font-display mx-auto mt-5 max-w-3xl text-[2.45rem] font-semibold leading-[1.08] tracking-[-0.035em] text-ink sm:text-[3.5rem]">
            Semua alat dokumen.<br /><span className="text-accent">Tanpa upload.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-relaxed text-muted sm:text-[16px]">
            Edit, convert, compress, dan manage PDF, Word, Excel, PowerPoint, dan gambar langsung di browser. Cepat, praktis, dan file tetap berada di perangkatmu.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-2.5 sm:flex-row">
            <Link to="/app" className="inline-flex h-11 items-center justify-center rounded-md bg-accent px-6 text-[13.5px] font-semibold text-accent-ink shadow-accent transition-all hover:bg-[var(--accent-strong)] active:scale-[0.98]">Mulai menggunakan Formatra <span className="ml-2">→</span></Link>
            <a href="#tools" className="inline-flex h-11 items-center justify-center rounded-md border-hair bg-surface px-6 text-[13.5px] font-semibold text-ink transition-colors hover:bg-surface-2">Lihat semua alat</a>
          </div>
        </div>
      </section>

      {/* Filter + tool grid */}
      <section id="tools" className="mx-auto max-w-6xl px-5 pb-16 lg:px-8">
        <div className="flex flex-wrap justify-center gap-2 pb-9">
  <button
    onClick={() => setActiveGroup("all")}
    className={`rounded-md border px-4 py-2 text-[13px] font-medium transition-all duration-200 ${
      activeGroup === "all"
        ? "border-accent bg-accent text-accent-ink shadow-soft"
        : "border-hair text-ink hover:border-accent hover:bg-accent/10 hover:text-accent hover:shadow-sm"
    }`}
  >
    Semua
  </button>

  {TOOL_GROUPS.map((g) => (
  <button
    key={g.id}
    onClick={() => setActiveGroup(g.id)}
    style={{
      "--group-color": g.color,
      "--group-color-bg": g.colorBg,
      ...(activeGroup === g.id
        ? {
            background: g.color,
            borderColor: g.color,
            color: "var(--accent-ink)",
          }
        : {}),
    }}
    className={`rounded-md border px-4 py-2 text-[13px] font-medium transition-all duration-200 ${
      activeGroup === g.id
        ? "shadow-soft"
        : "border-hair text-ink hover:border-[var(--group-color)] hover:bg-[var(--group-color-bg)] hover:text-[var(--group-color)] hover:shadow-sm"
    }`}
  >
    {g.label}
  </button>
))}
</div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleTools.map((tool) => (
            <ToolGridCard key={tool.id} tool={tool} />
          ))}
        </div>
      </section>

     

      {/* Features */}
      <section className="mx-auto max-w-6xl px-5 pb-14 lg:px-8">
        <h2 className="font-display mb-6 text-[13px] font-semibold text-ink">Kenapa Formatra</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => {
            const colors = ["var(--accent)", "var(--coral)", "var(--success)", "var(--sun)"];
            const color = colors[i % colors.length];
            return (
              <div
                key={f.title}
                className="flex flex-col gap-3 rounded-[18px] border-hair bg-surface p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft"
              >
                <div
                  className="flex size-9 items-center justify-center rounded-full"
                  style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}
                >
                  <f.icon className="size-[18px]" />
                </div>
                <div>
                  <p className="text-[13.5px] font-medium text-ink">{f.title}</p>
                  <p className="mt-1 text-[13px] leading-snug text-muted">{f.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Privacy highlight */}
      <section className="mx-auto max-w-6xl px-5 pb-14 lg:px-8">
        <div className="flex flex-col items-start gap-4 rounded-[22px] border-hair bg-surface p-7 shadow-soft sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-display text-[15px] font-semibold text-ink">File Anda tetap di perangkat Anda</p>
            <p className="mt-1.5 max-w-lg text-[13.5px] leading-relaxed text-muted">
              Formatra memproses file Anda langsung di browser. Tidak ada file yang diunggah ke server kami.
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-hair px-5 py-6 text-center text-[12px] text-muted">
        Formatra — diproses sepenuhnya di browser Anda.
      </footer>

      <button
        type="button"
        onClick={scrollToTop}
        aria-label="Kembali ke atas"
        className={`fixed bottom-6 right-5 z-50 flex size-11 items-center justify-center rounded-full bg-accent text-accent-ink shadow-soft transition-all duration-300 hover:-translate-y-0.5 lg:right-8 ${
          showBackToTop
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-3 opacity-0"
        }`}
      >
        <ChevronUp className="size-5" />
      </button>
    </div>
  );
}
