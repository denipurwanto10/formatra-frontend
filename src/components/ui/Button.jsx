import clsx from "clsx";
import { Loader2 } from "lucide-react";

const VARIANTS = {
  primary:
    "bg-accent text-accent-ink shadow-sm hover:bg-[var(--accent-strong)] hover:shadow-accent border border-transparent disabled:opacity-50 disabled:hover:shadow-none",
  secondary:
    "bg-transparent text-ink border-hair hover:bg-surface-2 hover:border-accent/40 disabled:opacity-50",
  ghost:
    "bg-transparent text-muted hover:text-ink hover:bg-surface-2 border border-transparent disabled:opacity-50",
  danger:
    "bg-transparent text-[var(--danger)] border border-[var(--danger)]/40 hover:bg-[var(--danger-bg)] hover:border-[var(--danger)]/70 disabled:opacity-50",
};

const SIZES = {
  sm: "h-8.5 px-3.5 text-[13px] gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-11.5 px-5.5 text-sm gap-2 rounded-xl",
};

export default function Button({
  as: Component = "button",
  variant = "primary",
  size = "md",
  className,
  icon: Icon,
  loading = false,
  children,
  ...props
}) {
  return (
    <Component
      className={clsx(
        "tap-target focus-ring inline-flex items-center justify-center font-medium transition-all duration-150 select-none whitespace-nowrap active:scale-[0.97] disabled:active:scale-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : Icon ? (
        <Icon className="size-4 shrink-0" />
      ) : null}
      {children}
    </Component>
  );
}
