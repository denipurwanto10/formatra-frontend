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
    <div className="group reveal flex items-center gap-2.5 rounded-xl border-hair bg-surface px-3 py-2.5 transition-[border-color,box-shadow] duration-300 ease-[var(--ease-out)] hover:border-[var(--border-strong)] hover:shadow-soft sm:gap-3 sm:px-3.5">
      {draggable && (
        <span
          className="cursor-grab rounded-md p-1 text-muted transition-colors hover:bg-surface-2 hover:text-ink active:cursor-grabbing"
          {...dragHandleProps}
        >
          <GripVertical className="size-4" />
        </span>
      )}
      {typeof index === "number" && (
        <span className="w-5 shrink-0 text-center font-mono text-[11.5px] text-muted">
          {index + 1}
        </span>
      )}
      <div className="flex size-9 shrink-0 items-center justify-center rounded-[9px] bg-surface-2 text-ink">
        <FileText className="size-4" strokeWidth={1.7} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-medium text-ink">{file.name}</p>
        <p className="font-mono text-[11.5px] text-muted">{formatBytes(file.size)}</p>
      </div>
      {trailing}
      {onRemove && (
        <button
          onClick={() => onRemove()}
          className="tap-target -mr-1 shrink-0 rounded-lg p-2 text-muted transition-colors hover:bg-[var(--danger-bg)] hover:text-[var(--danger)]"
          aria-label={`Hapus ${file.name}`}
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
