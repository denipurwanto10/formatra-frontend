import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, ChevronDown, ChevronUp, Menu, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import clsx from "clsx";
import { TOOL_GROUPS, TOOLS, TOOL_LIST, groupOfTool } from "../lib/toolsMeta";
import ThemeToggle from "../components/ThemeToggle";
import Logo from "../components/ui/Logo";
import Reveal from "../components/ui/Reveal";

const NAV_DIRECT = ["merge-pdf", "split-pdf", "compress-pdf"];

const PRINCIPLES = [
  {
    title: "Privat",
    desc: "File diproses langsung di perangkatmu dan tidak pernah dikirim ke server mana pun.",
  },
  {
    title: "Cepat",
    desc: "Tanpa antre unggah dan unduh. Hasil langsung tersedia begitu proses selesai di browser.",
  },
  {
    title: "Tanpa instalasi",
    desc: "Tidak perlu memasang aplikasi atau membuat akun. Buka, pilih alat, selesai.",
  },
  {
    title: "Di semua perangkat",
    desc: "Berjalan di Chrome, Edge, Firefox, atau Safari modern — desktop maupun ponsel.",
  },
];

/* ------------------------------------------------------------------ */
/* Header                                                              */
/* ------------------------------------------------------------------ */

function NavDropdown({ label, groupId }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const group = TOOL_GROUPS.find((g) => g.id === groupId);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div
      ref={wrapRef}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded-md py-1 text-[14px] text-muted transition-colors duration-200 hover:text-ink"
        aria-expanded={open}
        aria-haspopup="true"
      >
        {label}
        <ChevronDown className={clsx("size-3.5 transition-transform duration-300 ease-[var(--ease-out)]", open && "rotate-180")} />
      </button>
      <div
        data-open={open}
        className="popover-presence absolute left-1/2 top-full z-30 w-64 -translate-x-1/2 pt-3"
        aria-hidden={!open}
      >
        <div className="shadow-soft-lg rounded-[14px] border-hair bg-surface p-1.5">
          {group.tools.map((id) => {
            const Icon = TOOLS[id].icon;
            return (
              <Link
                key={id}
                to={`/tools/${id}`}
                tabIndex={open ? 0 : -1}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] text-ink transition-colors duration-150 hover:bg-surface-2"
              >
                <Icon className="size-4 text-muted" strokeWidth={1.7} />
                {TOOLS[id].name}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const mobileTools = TOOL_GROUPS.flatMap((g) => g.tools).slice(0, 8);

  return (
    <header
      className={clsx(
        "sticky top-0 z-40 border-b bg-[color-mix(in_srgb,var(--bg)_80%,transparent)] backdrop-blur-md transition-[border-color] duration-300",
        scrolled || mobileOpen ? "border-[var(--border)]" : "border-transparent"
      )}
    >
      <div className="px-5 lg:px-8">
      <div className="mx-auto flex h-16 max-w-[1160px] items-center justify-between">
        <Link to="/" aria-label="Formatra — beranda">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-7 lg:flex" aria-label="Menu utama">
          {NAV_DIRECT.map((id) => (
            <Link key={id} to={`/tools/${id}`} className="text-[14px] text-muted transition-colors duration-200 hover:text-ink">
              {TOOLS[id].name}
            </Link>
          ))}
          <NavDropdown label="Konversi" groupId="convert" />
          <NavDropdown label="Keamanan" groupId="optimize" />
          <Link to="/privacy" className="text-[14px] text-muted transition-colors duration-200 hover:text-ink">
            Privasi
          </Link>
        </nav>

        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <Link
            to="/app"
            className="tap-target hidden h-10 items-center gap-1.5 rounded-[10px] bg-accent px-4 text-[13.5px] font-medium text-accent-ink transition-[background-color,transform] duration-200 hover:bg-[var(--accent-strong)] active:scale-[0.97] sm:inline-flex"
          >
            Buka aplikasi
          </Link>
          <button
            onClick={() => setMobileOpen((o) => !o)}
            aria-expanded={mobileOpen}
            className="tap-target relative flex size-10 items-center justify-center rounded-lg text-ink transition-colors hover:bg-surface-2 lg:hidden"
            aria-label={mobileOpen ? "Tutup menu" : "Buka menu"}
          >
            <Menu className={clsx("absolute size-5 transition-all duration-300 ease-[var(--ease-out)]", mobileOpen ? "rotate-90 scale-50 opacity-0" : "opacity-100")} />
            <X className={clsx("absolute size-5 transition-all duration-300 ease-[var(--ease-out)]", mobileOpen ? "opacity-100" : "-rotate-90 scale-50 opacity-0")} />
          </button>
        </div>
      </div>
      </div>

      {/* Mobile panel */}
      <div
        className={clsx(
          "grid transition-[grid-template-rows] duration-500 ease-[var(--ease-out)] lg:hidden",
          mobileOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className={clsx("max-h-[calc(100dvh-4rem)] overflow-y-auto px-5 pb-6 pt-2 transition-opacity duration-300", mobileOpen ? "opacity-100" : "opacity-0")}>
            <p className="section-label px-1 pb-2">Alat populer</p>
            <div className="flex flex-col">
              {mobileTools.map((id, i) => {
                const Icon = TOOLS[id].icon;
                return (
                  <Link
                    key={id}
                    to={`/tools/${id}`}
                    onClick={() => setMobileOpen(false)}
                    tabIndex={mobileOpen ? 0 : -1}
                    style={{ transitionDelay: mobileOpen ? `${80 + i * 24}ms` : "0ms" }}
                    className={clsx(
                      "flex min-h-12 items-center gap-3 border-b border-hair px-1 text-[15px] text-ink transition-[opacity,transform] duration-500 ease-[var(--ease-out)] active:bg-surface-2",
                      mobileOpen ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0"
                    )}
                  >
                    <Icon className="size-[18px] text-muted" strokeWidth={1.7} />
                    {TOOLS[id].name}
                  </Link>
                );
              })}
            </div>
            <div className="mt-5 flex gap-2.5">
              <Link
                to="/app"
                onClick={() => setMobileOpen(false)}
                tabIndex={mobileOpen ? 0 : -1}
                className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-[10px] bg-accent text-[14.5px] font-medium text-accent-ink transition-transform active:scale-[0.98]"
              >
                Buka aplikasi <ArrowRight className="size-4" />
              </Link>
              <Link
                to="/privacy"
                onClick={() => setMobileOpen(false)}
                tabIndex={mobileOpen ? 0 : -1}
                className="inline-flex h-12 items-center justify-center rounded-[10px] border-hair px-5 text-[14.5px] text-ink transition-colors active:bg-surface-2"
              >
                Privasi
              </Link>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */

function HeroPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[460px] lg:max-w-none" aria-hidden="true">
      <div className="surface-elevated overflow-hidden rounded-[20px]">
        <div className="flex items-center justify-between border-b border-hair px-4 py-3">
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-[var(--border-strong)]" />
            <span className="size-2 rounded-full bg-[var(--border-strong)]" />
            <span className="size-2 rounded-full bg-[var(--border-strong)]" />
          </div>
          <span className="font-mono text-[11px] text-muted">Kompres PDF</span>
          <span className="w-9" />
        </div>

        <div className="space-y-6 p-5 sm:p-6">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-10 shrink-0 flex-col justify-end rounded-[6px] border-hair bg-surface-2 p-1.5">
              <span className="mb-1 block h-[3px] w-full rounded-full bg-[var(--border-strong)]" />
              <span className="mb-1 block h-[3px] w-3/4 rounded-full bg-[var(--border-strong)]" />
              <span className="block h-[3px] w-1/2 rounded-full bg-[var(--border-strong)]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium text-ink">laporan-keuangan.pdf</p>
              <p className="font-mono text-[11.5px] text-muted">12,4 MB · 48 halaman</p>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between text-[12px]">
              <span className="text-muted">Mengompres di perangkat…</span>
              <span className="font-mono text-ink">Lokal</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-accent" style={{ animation: "hero-bar 5.5s var(--ease-in-out) infinite alternate" }} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border-hair p-3.5">
              <p className="section-label">Sebelum</p>
              <p className="mt-1.5 font-mono text-[18px] tracking-tight text-ink">12,4 MB</p>
            </div>
            <div className="rounded-xl border-hair bg-surface-2 p-3.5">
              <p className="section-label">Sesudah</p>
              <p className="mt-1.5 font-mono text-[18px] tracking-tight text-ink">2,1 MB</p>
            </div>
          </div>
        </div>
      </div>
      <p className="mt-3 text-center text-[11.5px] text-muted lg:text-left">Contoh tampilan alat Kompres PDF</p>
    </div>
  );
}

function Hero() {
  return (
    <section className="relative px-5 pb-16 pt-10 sm:pb-20 sm:pt-16 lg:px-8 lg:pb-28 lg:pt-24">
      <div className="mx-auto grid max-w-[1160px] items-center gap-14 lg:grid-cols-[1.08fr_0.92fr] lg:gap-16">
        <div>
          <p className="animate-fade-up inline-flex items-center gap-2 text-[12.5px] text-muted">
            <span className="size-1.5 rounded-full bg-[var(--success)]" />
            Semua proses berjalan di perangkatmu
          </p>
          <h1
            className="animate-fade-up mt-5 text-[clamp(2.5rem,7.4vw,4.6rem)] font-semibold leading-[1.02] tracking-[-0.045em] text-ink"
            style={{ animationDelay: "70ms" }}
          >
            Semua alat dokumen.
            <br />
            <span className="text-muted">Tanpa upload.</span>
          </h1>
          <p
            className="animate-fade-up mt-6 max-w-[34rem] text-[16px] leading-[1.65] text-muted sm:text-[17px]"
            style={{ animationDelay: "140ms" }}
          >
            Edit, konversi, kompres, dan atur PDF, Word, Excel, PowerPoint, gambar, hingga video langsung di browser. File tetap berada di perangkatmu.
          </p>
          <div className="animate-fade-up mt-8 flex flex-col gap-3 sm:flex-row sm:items-center" style={{ animationDelay: "210ms" }}>
            <Link
              to="/app"
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-[11px] bg-accent px-6 text-[14.5px] font-medium text-accent-ink transition-[background-color,transform] duration-200 hover:bg-[var(--accent-strong)] active:scale-[0.98]"
            >
              Mulai gunakan
              <ArrowRight className="size-4 transition-transform duration-300 ease-[var(--ease-out)] group-hover:translate-x-0.5" />
            </Link>
            <a
              href="#tools"
              className="inline-flex h-12 items-center justify-center rounded-[11px] px-4 text-[14.5px] text-ink transition-colors duration-200 hover:bg-surface-2"
            >
              Lihat semua alat
            </a>
          </div>

          <dl className="animate-fade-up mt-12 grid max-w-md grid-cols-3 gap-6 border-t border-hair pt-6" style={{ animationDelay: "280ms" }}>
            {[
              [String(TOOL_LIST.length), "alat siap pakai"],
              ["0 byte", "diunggah ke server"],
              ["Tanpa", "akun atau instalasi"],
            ].map(([value, label]) => (
              <div key={label}>
                <dt className="font-mono text-[15px] tracking-tight text-ink sm:text-[17px]">{value}</dt>
                <dd className="mt-1 text-[12px] leading-snug text-muted">{label}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="animate-fade-up" style={{ animationDelay: "200ms" }}>
          <HeroPreview />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Tools                                                               */
/* ------------------------------------------------------------------ */

function ToolGridCard({ tool, index }) {
  const Icon = tool.icon;
  const group = groupOfTool(tool.id);
  return (
    <Link
      to={`/tools/${tool.id}`}
      style={{ "--tool-color": group?.color ?? "var(--ink)", "--i": Math.min(index, 14) }}
      className="stagger-item group relative flex flex-col gap-5 rounded-[14px] border-hair bg-surface p-5 transition-[border-color,background-color,box-shadow,transform] duration-300 ease-[var(--ease-out)] hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-2)] active:translate-y-0 active:scale-[0.995]"
    >
      <div className="flex items-start justify-between">
        <div className="flex size-10 items-center justify-center rounded-[10px] bg-surface-2 text-[var(--tool-color)] transition-transform duration-500 ease-[var(--ease-out)] group-hover:scale-105">
          <Icon className="size-[18px]" strokeWidth={1.7} />
        </div>
        <ArrowUpRight className="size-4 -translate-x-1 translate-y-1 text-muted opacity-0 transition-all duration-300 ease-[var(--ease-out)] group-hover:translate-x-0 group-hover:translate-y-0 group-hover:opacity-100" />
      </div>
      <div>
        <p className="text-[15px] font-medium tracking-[-0.01em] text-ink">{tool.name}</p>
        <p className="mt-1.5 line-clamp-2 text-[13.5px] leading-relaxed text-muted">{tool.description}</p>
      </div>
    </Link>
  );
}

function GroupTabs({ active, onChange }) {
  const listRef = useRef(null);
  const [bar, setBar] = useState({ left: 0, width: 0, ready: false });
  const tabs = [{ id: "all", label: "Semua" }, ...TOOL_GROUPS.map((g) => ({ id: g.id, label: g.label }))];

  useLayoutEffect(() => {
    const measure = () => {
      const el = listRef.current?.querySelector(`[data-tab="${active}"]`);
      if (!el) return;
      setBar({ left: el.offsetLeft, width: el.offsetWidth, ready: true });
      // keep the active tab visible on narrow screens
      const list = listRef.current;
      const target = el.offsetLeft - (list.clientWidth - el.offsetWidth) / 2;
      list.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [active]);

  return (
    <div className="-mx-5 border-b border-hair px-5 lg:mx-0 lg:px-0">
      <div ref={listRef} role="tablist" aria-label="Filter kategori alat" className="scrollbar-hidden relative flex gap-1 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            data-tab={t.id}
            role="tab"
            aria-selected={active === t.id}
            onClick={() => onChange(t.id)}
            className={clsx(
              "relative shrink-0 whitespace-nowrap px-3.5 py-3 text-[14px] transition-colors duration-200",
              active === t.id ? "font-medium text-ink" : "text-muted hover:text-ink"
            )}
          >
            {t.label}
          </button>
        ))}
        <span
          aria-hidden="true"
          className="absolute bottom-0 left-0 h-[2px] rounded-full bg-accent"
          style={{
            width: bar.width,
            transform: `translateX(${bar.left}px)`,
            transition: bar.ready ? "transform 420ms var(--ease-out), width 420ms var(--ease-out)" : "none",
          }}
        />
      </div>
    </div>
  );
}

function ToolsSection() {
  const [activeGroup, setActiveGroup] = useState("all");
  const visibleTools =
    activeGroup === "all"
      ? TOOL_LIST
      : TOOL_GROUPS.find((g) => g.id === activeGroup).tools.map((id) => TOOLS[id]);
  const activeMeta = TOOL_GROUPS.find((g) => g.id === activeGroup);

  return (
    <section id="tools" className="scroll-mt-20 px-5 pb-20 lg:px-8 lg:pb-28">
      <div className="mx-auto max-w-[1160px]">
        <Reveal className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="section-label">Alat</p>
            <h2 className="mt-2 text-[1.75rem] font-semibold leading-tight tracking-[-0.035em] text-ink sm:text-[2.1rem]">
              Semua yang kamu perlukan, satu tempat.
            </h2>
          </div>
          <p className="max-w-xs text-[14px] leading-relaxed text-muted sm:text-right">
            {activeMeta ? activeMeta.blurb : `${TOOL_LIST.length} alat untuk PDF, dokumen, gambar, dan video.`}
          </p>
        </Reveal>

        <Reveal delay={80}>
          <GroupTabs active={activeGroup} onChange={setActiveGroup} />
        </Reveal>

        <div key={activeGroup} className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleTools.map((tool, i) => (
            <ToolGridCard key={tool.id} tool={tool} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Principles, privacy, footer                                         */
/* ------------------------------------------------------------------ */

function Principles() {
  return (
    <section className="px-5 pb-20 lg:px-8 lg:pb-28">
      <div className="mx-auto max-w-[1160px]">
        <Reveal className="mb-10 max-w-xl">
          <p className="section-label">Kenapa Formatra</p>
          <h2 className="mt-2 text-[1.75rem] font-semibold leading-tight tracking-[-0.035em] text-ink sm:text-[2.1rem]">
            Dibuat sederhana, tanpa kompromi soal privasi.
          </h2>
        </Reveal>
        <div className="grid gap-x-10 gap-y-9 border-t border-hair pt-8 sm:grid-cols-2 lg:grid-cols-4">
          {PRINCIPLES.map((p, i) => (
            <Reveal key={p.title} delay={i * 80}>
              <p className="font-mono text-[12px] text-muted">{String(i + 1).padStart(2, "0")}</p>
              <p className="mt-3 text-[16px] font-medium tracking-[-0.015em] text-ink">{p.title}</p>
              <p className="mt-2 text-[14px] leading-relaxed text-muted">{p.desc}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function PrivacyBand() {
  return (
    <section className="px-5 pb-20 lg:px-8 lg:pb-28">
      <Reveal className="mx-auto max-w-[1160px]">
        <div className="flex flex-col items-start justify-between gap-6 rounded-[20px] bg-accent p-7 text-accent-ink sm:p-10 md:flex-row md:items-center">
          <div className="max-w-xl">
            <h2 className="text-[1.45rem] font-semibold leading-tight tracking-[-0.03em] sm:text-[1.8rem]">
              File kamu tetap di perangkatmu.
            </h2>
            <p className="mt-3 text-[14.5px] leading-relaxed opacity-70">
              Formatra memproses semuanya langsung di browser. Tidak ada file yang diunggah ke server kami — tidak sekarang, tidak nanti.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row">
            <Link
              to="/app"
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-[11px] bg-[var(--accent-ink)] px-6 text-[14.5px] font-medium text-[var(--accent)] transition-transform duration-200 active:scale-[0.98]"
            >
              Coba sekarang
              <ArrowRight className="size-4 transition-transform duration-300 ease-[var(--ease-out)] group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/privacy"
              className="inline-flex h-12 items-center justify-center rounded-[11px] px-5 text-[14.5px] opacity-80 transition-opacity duration-200 hover:opacity-100"
            >
              Baca kebijakan privasi
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-hair px-5 py-8 lg:px-8">
      <div className="mx-auto flex max-w-[1160px] flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
        <Logo textClassName="text-[15px]" />
        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] text-muted" aria-label="Footer">
          <Link to="/app" className="transition-colors hover:text-ink">Aplikasi</Link>
          <a href="#tools" className="transition-colors hover:text-ink">Alat</a>
          <Link to="/privacy" className="transition-colors hover:text-ink">Privasi</Link>
        </nav>
        <p className="text-[12.5px] text-muted">Diproses sepenuhnya di browser Anda.</p>
      </div>
    </footer>
  );
}

export default function Landing() {
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    document.title = "Formatra — Alat dokumen yang berjalan di perangkatmu";
    const onScroll = () => setShowBackToTop(window.scrollY > 600);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="page-enter min-h-dvh bg-base text-ink">
      <Header />
      <main>
        <Hero />
        <ToolsSection />
        <Principles />
        <PrivacyBand />
      </main>
      <Footer />

      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label="Kembali ke atas"
        className={clsx(
          "tap-target fixed bottom-5 right-4 z-50 flex size-11 items-center justify-center rounded-full border-hair bg-surface text-ink shadow-[var(--shadow-2)] transition-[opacity,transform,background-color] duration-400 ease-[var(--ease-out)] hover:bg-surface-2 lg:right-8",
          showBackToTop ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
        )}
      >
        <ChevronUp className="size-5" />
      </button>
    </div>
  );
}
