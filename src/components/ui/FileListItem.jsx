import { FileText, X, GripVertical } from "lucide-react";
import { formatBytes } from "../../utils/formatBytes";

export default function FileListItem({
  file,
  onRemove,
  draggable = false,
  dragHandleProps,
  index,
  trailing,
}) {
  return (
    <div className="group flex items-center gap-2.5 rounded-[var(--radius-md)] sm:gap-3 border-hair bg-surface px-3.5 py-3 shadow-soft transition-all duration-150 hover:border-accent/25 hover:shadow-soft-lg">
      {draggable && (
        <span
          className="cursor-grab rounded-md p-1 text-muted transition-colors hover:bg-surface-2 hover:text-ink active:cursor-grabbing"
          {...dragHandleProps}
        >
          <GripVertical className="size-4" />
        </span>
      )}
      {typeof index === "number" && (
        <span className="w-5 shrink-0 text-center font-mono text-xs text-muted">
          {index + 1}
        </span>
      )}
      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-accent/10 bg-accent/10 text-accent">
        <FileText className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-ink">{file.name}</p>
        <p className="font-mono text-[11px] text-muted">{formatBytes(file.size)}</p>
      </div>
      {trailing}
      {onRemove && (
        <button
          onClick={() => onRemove()}
          className="tap-target shrink-0 rounded-lg p-2 text-muted opacity-70 transition-all hover:bg-danger-bg hover:text-[var(--danger)] hover:opacity-100"
          aria-label={`Hapus ${file.name}`}
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
