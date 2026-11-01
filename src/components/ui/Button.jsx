import clsx from "clsx";
import { Loader2 } from "lucide-react";

const VARIANTS = {
  primary:
    "bg-accent text-accent-ink border border-transparent hover:bg-[var(--accent-strong)] disabled:opacity-45",
  secondary:
    "bg-surface text-ink border border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-surface-2 disabled:opacity-45",
  ghost:
    "bg-transparent text-muted hover:text-ink hover:bg-surface-2 border border-transparent disabled:opacity-45",
  danger:
    "bg-transparent text-[var(--danger)] border border-[color-mix(in_srgb,var(--danger)_35%,transparent)] hover:bg-[var(--danger-bg)] hover:border-[color-mix(in_srgb,var(--danger)_60%,transparent)] disabled:opacity-45",
};

const SIZES = {
  sm: "h-9 px-3.5 text-[13px] gap-1.5 rounded-lg",
  md: "h-10 px-4 text-[14px] gap-2 rounded-[10px]",
  lg: "h-11 px-5 text-[14px] gap-2 rounded-[10px]",
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
        "tap-target focus-ring inline-flex select-none items-center justify-center whitespace-nowrap font-medium tracking-[-0.005em]",
        "transition-[background-color,border-color,color,transform,opacity] duration-200 ease-[var(--ease-out)]",
        "active:scale-[0.975] disabled:cursor-not-allowed disabled:active:scale-100",
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
