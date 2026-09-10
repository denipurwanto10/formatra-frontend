import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import clsx from "clsx";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { TOOLS } from "../../lib/toolsMeta";

function pageTitle(pathname) {
  if (pathname === "/app") return "Dashboard";
  const match = Object.values(TOOLS).find((t) => pathname === `/tools/${t.id}`);
  return match ? match.name : "Formatra";
}

const DRAWER_ANIM_MS = 220;
const SIDEBAR_COLLAPSE_KEY = "formatra-sidebar-collapsed";

/** Mobile nav drawer: slides in from the left with a fading backdrop, and
 * — unlike a plain conditional render — plays the same animation in reverse
 * on close instead of just vanishing. */
function MobileDrawer({ open, onClose, children }) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    setVisible(false);
    const timeout = setTimeout(() => setMounted(false), DRAWER_ANIM_MS);
    return () => clearTimeout(timeout);
  }, [open]);

  useEffect(() => {
    if (!mounted) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mounted, onClose]);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true">
      <div
        className={clsx(
          "absolute inset-0 bg-black/40 transition-opacity duration-200 ease-out",
          visible ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={clsx(
          "relative shadow-soft-lg transition-transform duration-200 ease-out will-change-transform",
          visible ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {children}
      </div>
    </div>
  );
}

export default function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const location = useLocation();

  // Close the drawer automatically on every navigation, in case a click
  // lands somewhere inside Sidebar that doesn't already call onNavigate.
  useEffect(() => {
    setDrawerOpen(false);
    document.title = pageTitle(location.pathname) === "Dashboard"
      ? "Formatra — Dashboard"
      : `Formatra — ${pageTitle(location.pathname)}`;
    document.getElementById("main-content")?.scrollTo({ top: 0, behavior: "auto" });
  }, [location.pathname]);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        // ignore storage errors (private mode, etc.)
      }
      return next;
    });
  };

  return (
    // h-dvh instead of h-screen: on mobile browsers 100vh is measured
    // against the *largest* possible viewport (address bar hidden), so a
    // page that fills 100vh sits partly behind the address bar and the
    // fixed mobile toolbar below it overflows/clips as the bar shows and
    // hides. dvh tracks the actual visible viewport instead.
    <div className="flex h-dvh w-full bg-base text-ink">
      <a href="#main-content" className="skip-link">Lewati ke konten utama</a>
      {/* Desktop sidebar — collapsible, state persisted across visits */}
      <div className="hidden lg:block">
        <Sidebar collapsed={collapsed} onToggleCollapse={toggleCollapsed} />
      </div>

      {/* Mobile drawer */}
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <Sidebar onNavigate={() => setDrawerOpen(false)} />
      </MobileDrawer>

      {/* min-h-0 is required here: without it this flex column sizes itself
          to its content (Topbar + whatever <main> contains) instead of to
          the h-dvh parent, so <main>'s own min-h-0/overflow-y-auto never
          gets a bounded height to scroll within — every "fit to screen" or
          "h-full" calculation downstream (e.g. the PDF editor's canvas
          area) inherits that unbounded height and breaks. */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Topbar
          title={pageTitle(location.pathname)}
          menuOpen={drawerOpen}
          onMenuClick={() => setDrawerOpen((v) => !v)}
        />
        <main id="main-content" tabIndex="-1" className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto page-enter">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
