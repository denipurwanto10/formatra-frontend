import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { TOOLS } from "../../lib/toolsMeta";
import { usePresence } from "../../hooks/usePresence";

function pageTitle(pathname) {
  if (pathname === "/app") return "Dashboard";
  const match = Object.values(TOOLS).find((t) => pathname === `/tools/${t.id}`);
  return match ? match.name : "Formatra";
}

const SIDEBAR_COLLAPSE_KEY = "formatra-sidebar-collapsed";

/** Mobile nav drawer: slides in with a fading backdrop and plays the same
 * motion in reverse on close. */
function MobileDrawer({ open, onClose, children }) {
  const { mounted, visible } = usePresence(open, 360);

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
    <div className="fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true" aria-label="Navigasi">
      <div
        data-open={visible}
        className="fade-presence absolute inset-0 bg-[color-mix(in_srgb,var(--ink)_42%,transparent)] backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div data-open={visible} className="drawer-presence shadow-soft-lg relative h-full max-w-[86vw]">
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

  useEffect(() => {
    setDrawerOpen(false);
    const title = pageTitle(location.pathname);
    document.title = `Formatra — ${title}`;
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
    <div className="flex h-dvh w-full bg-base text-ink">
      <a href="#main-content" className="skip-link">Lewati ke konten utama</a>
      <div className="hidden lg:block">
        <Sidebar collapsed={collapsed} onToggleCollapse={toggleCollapsed} />
      </div>

      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <Sidebar onNavigate={() => setDrawerOpen(false)} />
      </MobileDrawer>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          title={pageTitle(location.pathname)}
          menuOpen={drawerOpen}
          onMenuClick={() => setDrawerOpen((v) => !v)}
        />
        {/* Keyed by route: a fresh scroll position and a fresh enter animation per page. */}
        <main
          key={location.pathname}
          id="main-content"
          tabIndex="-1"
          className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto outline-none [scrollbar-gutter:stable]"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
