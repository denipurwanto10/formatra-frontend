import { NavLink, Link } from "react-router-dom";
import { LayoutGrid, FileStack, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { TOOL_GROUPS, TOOLS } from "../../lib/toolsMeta";
import clsx from "clsx";

function NavItem({ to, icon: Icon, children, end, color, collapsed }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        clsx(
          "group relative flex items-center gap-2.5 rounded-xl py-2.5 text-[13px] font-medium transition-all duration-100 active:scale-[0.97]",
          collapsed ? "justify-center px-0" : "pl-3 pr-2.5",
          isActive
            ? "bg-accent/10 text-accent"
            : "text-muted hover:bg-surface-2/60 hover:text-ink active:bg-surface-2",
          collapsed && "tooltip"
        )
      }
      data-tooltip={collapsed ? children : undefined}
    >
      {({ isActive }) => (
        <>
          {!collapsed && (
            <span
              style={{ background: color ?? "var(--accent)" }}
              className={clsx(
                "absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full transition-all duration-150",
                isActive ? "opacity-100" : "opacity-0 group-active:opacity-60"
              )}
            />
          )}
          <Icon className="size-[17px] shrink-0" />
          {!collapsed && <span className="truncate">{children}</span>}
        </>
      )}
    </NavLink>
  );
}

export default function Sidebar({ onNavigate, collapsed = false, onToggleCollapse }) {
  return (
    <nav
      className={clsx(
        "flex h-full flex-col overflow-y-auto overflow-x-hidden border-r border-hair bg-surface transition-[width] duration-150",
        collapsed ? "w-[68px]" : "w-64"
      )}
      onClick={onNavigate}
    >
      <div className={clsx("flex items-center border-b border-hair/70 pb-4 pt-5", collapsed ? "justify-center px-2" : "justify-between px-4")}>
        <Link to="/" className="flex min-w-0 items-center gap-2.5">
          <div className="relative flex size-8 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-ink">
            <FileStack className="size-[18px]" />
            <span className="absolute -right-1 -top-1 size-2.5 rounded-full bg-[var(--coral)]" aria-hidden="true" />
          </div>
          {!collapsed && (
            <span className="truncate font-display text-[16px] font-semibold tracking-tight text-ink">
              Formatra
            </span>
          )}
        </Link>
        {!collapsed && onToggleCollapse && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse();
            }}
            aria-label="Ciutkan sidebar"
            className="hidden shrink-0 rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-ink lg:flex"
          >
            <PanelLeftClose className="size-4" />
          </button>
        )}
      </div>

      {collapsed && onToggleCollapse && (
        <div className="mb-1 flex justify-center px-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse();
            }}
            aria-label="Perluas sidebar"
            className="tooltip flex size-8 shrink-0 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-ink"
            data-tooltip="Perluas sidebar"
          >
            <PanelLeftOpen className="size-4" />
          </button>
        </div>
      )}

      <div className={clsx("flex flex-col gap-0.5", collapsed ? "px-2" : "px-3")}>
        <NavItem to="/app" end icon={LayoutGrid} collapsed={collapsed}>
          Dashboard
        </NavItem>
      </div>

      <div className={clsx("mt-2 flex flex-1 flex-col gap-5 pb-4", collapsed ? "px-2" : "px-3")}>
        {TOOL_GROUPS.map((group) => (
          <div key={group.id} className="flex flex-col gap-0.5">
            {!collapsed ? (
              <p className="mb-1 flex items-center gap-2 pl-3 text-[11px] font-medium text-muted">
                <span className="size-1.5 rounded-full" style={{ background: group.color }} />
                {group.label}
              </p>
            ) : (
              <div className="mb-1 flex justify-center" aria-hidden="true">
                <span className="h-px w-6 bg-border" />
              </div>
            )}
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
