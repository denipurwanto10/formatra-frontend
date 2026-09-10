export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="reveal flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-hair px-6 py-14 text-center">
      {Icon && (
        <div className="flex size-11 items-center justify-center rounded-full bg-surface-2 text-muted">
          <Icon className="size-5" />
        </div>
      )}
      <div className="space-y-1">
        <p className="text-sm font-medium text-ink">{title}</p>
        {description && <p className="max-w-xs text-[13px] text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
