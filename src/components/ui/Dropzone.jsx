import { useCallback, useMemo, useRef, useState } from "react";
import { UploadCloud, Loader2, ShieldCheck } from "lucide-react";
import clsx from "clsx";
import { validateFiles } from "../../utils/fileValidation";
import { useToast } from "../../context/ToastContext";

const DEFAULT_MAX_SIZE_MB = 300;

function formatAccept(accept) {
  if (!accept) return null;
  return accept.split(",").map((s) => s.trim().replace(/^\./, "").toUpperCase()).filter(Boolean).join(", ");
}

export default function Dropzone({
  accept,
  multiple = false,
  onFiles,
  label = "Tarik & lepas file di sini",
  hint,
  compact = false,
  maxSizeMB = DEFAULT_MAX_SIZE_MB,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [validating, setValidating] = useState(false);
  const inputRef = useRef(null);
  const dragDepth = useRef(0);
  const toast = useToast();
  const formats = useMemo(() => formatAccept(accept), [accept]);

  const handleFiles = useCallback(async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const candidates = multiple ? files : [files[0]];
    setValidating(true);
    const { valid, errors } = await validateFiles(candidates, { accept, maxSizeMB });
    setValidating(false);
    if (errors.length) {
      toast.error(errors.length > 1 ? `${errors.length} file ditolak` : "File ditolak", errors[0] + (errors.length > 1 ? ` (+${errors.length - 1} lainnya)` : ""));
    }
    if (valid.length) onFiles(valid);
  }, [multiple, onFiles, accept, maxSizeMB, toast]);

  const openPicker = () => inputRef.current?.click();

  return (
    <div
      onDragEnter={(e) => { e.preventDefault(); dragDepth.current += 1; setIsDragging(true); }}
      onDragOver={(e) => { e.preventDefault(); }}
      onDragLeave={() => { dragDepth.current = Math.max(0, dragDepth.current - 1); if (dragDepth.current === 0) setIsDragging(false); }}
      onDrop={(e) => { e.preventDefault(); dragDepth.current = 0; setIsDragging(false); handleFiles(e.dataTransfer.files); }}
      onDragEnd={() => { dragDepth.current = 0; setIsDragging(false); }}
      onClick={openPicker}
      role="button"
      tabIndex={0}
      aria-label={multiple ? "Pilih atau seret beberapa file untuk diproses" : "Pilih atau seret file untuk diproses"}
      aria-busy={validating}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openPicker(); } }}
      className={clsx(
        "tool-workspace group relative flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[18px] border border-dashed text-center",
        "transition-[border-color,background-color,transform,box-shadow] duration-300 ease-[var(--ease-out)]",
        compact ? "px-4 py-7" : "min-h-[280px] px-5 py-10 sm:min-h-[340px] sm:px-6 sm:py-14",
        isDragging
          ? "scale-[1.006] border-[var(--ink)] bg-surface-2"
          : "border-[var(--border-strong)] bg-surface hover:border-[var(--ink)]/60 hover:bg-[color-mix(in_srgb,var(--surface-2)_45%,var(--surface))]"
      )}
    >
      <div className="relative z-10 flex max-w-md flex-col items-center">
        <div
          className={clsx(
            "mb-5 flex size-14 items-center justify-center rounded-2xl border-hair bg-surface-2 text-ink",
            "transition-transform duration-500 ease-[var(--ease-out)] group-hover:-translate-y-0.5",
            isDragging && "-translate-y-1 scale-105"
          )}
        >
          {validating ? <Loader2 className="size-6 animate-spin" /> : <UploadCloud className="size-6" strokeWidth={1.6} />}
        </div>
        <p className="text-[16px] font-medium tracking-[-0.015em] text-ink sm:text-[17px]">
          {validating ? "Memeriksa file…" : isDragging ? "Lepaskan untuk mulai" : label}
        </p>
        {!validating && (
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">
            atau pilih dari perangkatmu — file tidak diunggah.
          </p>
        )}
        {!validating && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); openPicker(); }}
            className="tap-target focus-ring mt-6 inline-flex h-11 items-center gap-2 rounded-[10px] bg-accent px-5 text-[14px] font-medium text-accent-ink transition-[background-color,transform] duration-200 hover:bg-[var(--accent-strong)] active:scale-[0.97]"
          >
            Pilih file
          </button>
        )}
        {!validating && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[11.5px] text-muted">
            {formats && <span className="font-mono">{formats}</span>}
            {formats && maxSizeMB && <span aria-hidden="true" className="size-[3px] rounded-full bg-[var(--border-strong)]" />}
            {maxSizeMB && <span>Maks. {maxSizeMB} MB</span>}
            <span aria-hidden="true" className="size-[3px] rounded-full bg-[var(--border-strong)]" />
            <span className="inline-flex items-center gap-1 text-[var(--success)]"><ShieldCheck className="size-3" /> Lokal</span>
          </div>
        )}
        {hint && !validating && <p className="mt-3 max-w-sm text-[12px] text-muted">{hint}</p>}
      </div>
      <input ref={inputRef} type="file" accept={accept} multiple={multiple} className="hidden" onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
    </div>
  );
}
