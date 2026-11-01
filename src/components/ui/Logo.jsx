import clsx from "clsx";

/** Wordmark: a quiet monogram with a single signal-coloured dot. */
export function LogoMark({ className }) {
  return (
    <span
      aria-hidden="true"
      className={clsx(
        "relative inline-flex size-7 shrink-0 items-center justify-center rounded-[8px] bg-accent text-accent-ink",
        className
      )}
    >
      <svg viewBox="0 0 24 24" fill="none" className="size-[15px]">
        <path d="M7 4.5h8.5M7 4.5v15M7 12h6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="absolute -right-[3px] -top-[3px] size-[7px] rounded-full bg-[var(--signal)] ring-2 ring-[var(--bg)]" />
    </span>
  );
}

export default function Logo({ className, textClassName, showText = true }) {
  return (
    <span className={clsx("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      {showText && (
        <span className={clsx("font-display text-[16px] font-semibold tracking-[-0.03em] text-ink", textClassName)}>
          Formatra
        </span>
      )}
    </span>
  );
}
