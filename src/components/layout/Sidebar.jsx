import { useEffect, useRef } from "react";
import { NavLink, Link } from "react-router-dom";
import { LayoutGrid, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { TOOL_GROUPS, TOOLS } from "../../lib/toolsMeta";
import Logo, { LogoMark } from "../ui/Logo";
import clsx from "clsx";

const ICON_X = "px-[13px]"; // keeps icons pinned in place while the sidebar width animates

function NavItem({ to, icon: Icon, children, end, color, collapsed }) {
  return (
    <NavLink
      to={to}
      end={end}
      title={collapsed ? String(children) : undefined}
      className={({ isActive }) =>
        clsx(
          "group relative flex h-9 items-center gap-3 rounded-lg text-[13.5px] transition-[background-color,color,transform] duration-200 ease-[var(--ease-out)] active:scale-[0.985]",
          ICON_X,
          isActive
            ? "bg-surface-2 font-medium text-ink"
            : "text-muted hover:bg-[color-mix(in_srgb,var(--surface-2)_70%,transparent)] hover:text-ink"
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            aria-hidden="true"
            style={{ background: color ?? "var(--ink)" }}
            className={clsx(
              "absolute -left-3 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full transition-all duration-300 ease-[var(--ease-out)]",
              isActive ? "scale-y-100 opacity-100" : "scale-y-0 opacity-0"
            )}
          />
          <Icon
            className="size-[17px] shrink-0 transition-colors duration-200"
            strokeWidth={1.7}
            style={isActive && color ? { color } : undefined}
          />
          <span
            className={clsx(
              "truncate whitespace-nowrap transition-opacity duration-200",
              collapsed ? "pointer-events-none opacity-0" : "opacity-100 delay-75"
            )}
          >
            {children}
          </span>
        </>
      )}
    </NavLink>
  );
}

export default function Sidebar({ onNavigate, collapsed = false, onToggleCollapse }) {
  const navRef = useRef(null);

  // Bring the active tool into view when the sidebar first renders.
  useEffect(() => {
    const el = navRef.current?.querySelector('[aria-current="page"]');
    el?.scrollIntoView({ block: "nearest" });
  }, []);

  return (
    <nav
      ref={navRef}
      aria-label="Navigasi utama"
      className={clsx(
        "flex h-full flex-col overflow-y-auto overflow-x-hidden border-r border-hair bg-surface",
        "transition-[width] duration-300 ease-[var(--ease-out)]",
        collapsed ? "w-[68px]" : "w-[256px]"
      )}
      onClick={onNavigate}
    >
      <div className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between bg-surface px-3">
        <Link to="/" className="flex min-w-0 items-center gap-2.5 rounded-lg px-[10px] py-1.5" aria-label="Formatra — beranda">
          <LogoMark />
          <span
            className={clsx(
              "truncate font-display text-[16px] font-semibold tracking-[-0.03em] text-ink transition-opacity duration-200",
              collapsed ? "pointer-events-none opacity-0" : "opacity-100 delay-75"
            )}
          >
            Formatra
          </span>
        </Link>
        {onToggleCollapse && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse();
            }}
            aria-label={collapsed ? "Perluas sidebar" : "Ciutkan sidebar"}
            className={clsx(
              "hidden size-8 shrink-0 items-center justify-center rounded-lg text-muted transition-[background-color,color,opacity] duration-200 hover:bg-surface-2 hover:text-ink lg:flex",
              collapsed && "absolute right-[-1px] opacity-0 focus-visible:opacity-100"
            )}
          >
            <PanelLeftClose className="size-4" strokeWidth={1.7} />
          </button>
        )}
      </div>

      {collapsed && onToggleCollapse && (
        <div className="animate-fade-in mb-1 flex justify-center px-3">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse();
            }}
            aria-label="Perluas sidebar"
            className="tooltip flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink"
            data-tooltip="Perluas sidebar"
          >
            <PanelLeftOpen className="size-4" strokeWidth={1.7} />
          </button>
        </div>
      )}

      <div className="flex flex-col gap-0.5 px-3 pt-1">
        <NavItem to="/app" end icon={LayoutGrid} collapsed={collapsed}>
          Dashboard
        </NavItem>
      </div>

      <div className="mt-3 flex flex-1 flex-col gap-4 px-3 pb-6">
        {TOOL_GROUPS.map((group) => (
          <div key={group.id} className="flex flex-col gap-0.5">
            <div className="relative flex h-6 items-center" aria-hidden={collapsed || undefined}>
              <p
                className={clsx(
                  "flex items-center gap-2 pl-[13px] text-[11px] font-medium uppercase tracking-[0.07em] text-muted transition-opacity duration-200",
                  collapsed ? "opacity-0" : "opacity-100 delay-75"
                )}
              >
                <span className="size-1.5 shrink-0 rounded-full" style={{ background: group.color }} />
                <span className="truncate whitespace-nowrap">{group.label}</span>
              </p>
              <span
                className={clsx(
                  "absolute inset-x-3 top-1/2 h-px bg-[var(--border)] transition-opacity duration-200",
                  collapsed ? "opacity-100" : "opacity-0"
                )}
              />
            </div>
            {group.tools.map((toolId) => {
              const tool = TOOLS[toolId];
              return (
                <NavItem
                  key={tool.id}
                  to={`/tools/${tool.id}`}
                  icon={tool.icon}
                  color={group.color}
                  collapsed={collapsed}
                >
                  {tool.short}
                </NavItem>
              );
            })}
          </div>
        ))}
      </div>
    </nav>
  );
}
