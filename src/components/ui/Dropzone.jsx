import { useCallback, useMemo, useRef, useState } from "react";
import { UploadCloud, Loader2, FolderOpen, ShieldCheck } from "lucide-react";
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
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
      onDragEnd={() => setIsDragging(false)}
      onClick={openPicker}
      role="button"
      tabIndex={0}
      aria-label={multiple ? "Pilih atau seret beberapa file untuk diproses" : "Pilih atau seret file untuk diproses"}
      aria-busy={validating}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openPicker(); } }}
      className={clsx(
        "tool-workspace group relative flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[22px] border-2 border-dashed text-center transition-all duration-200",
        compact ? "px-4 py-7" : "min-h-[320px] px-6 py-12 sm:min-h-[350px]",
        isDragging ? "scale-[1.005] border-accent bg-accent/8 shadow-accent" : "border-[var(--border)] bg-surface hover:border-accent/45 hover:bg-surface-2/40 hover:shadow-soft"
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-grain opacity-40" aria-hidden="true" />
      <div className="relative z-10 flex max-w-md flex-col items-center">
        <div className={clsx("mb-4 flex size-16 items-center justify-center rounded-[20px] border border-accent/15 bg-accent/10 text-accent transition-transform duration-200", isDragging && "scale-110") }>
          {validating ? <Loader2 className="size-7 animate-spin" /> : <UploadCloud className="size-7" />}
        </div>
        <p className="text-[15px] font-semibold text-ink sm:text-base">
          {validating ? "Memeriksa file..." : isDragging ? "Lepaskan file di sini" : label}
        </p>
        {!validating && <p className="mt-2 text-[13px] leading-relaxed text-muted">atau pilih dari perangkatmu. File tetap di browser dan tidak diunggah.</p>}
        {!validating && (
          <button type="button" onClick={(e) => { e.stopPropagation(); openPicker(); }} className="mt-4 inline-flex min-h-11 h-11 items-center gap-2 rounded-md bg-accent px-4 text-[13px] font-semibold text-accent-ink shadow-accent transition-all hover:bg-[var(--accent-strong)] active:scale-[0.98]">
            <FolderOpen className="size-4" /> Pilih file
          </button>
        )}
        {!validating && (
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-[11px] text-muted">
            {formats && <span className="rounded-full bg-surface-2 px-2.5 py-1 font-mono">{formats}</span>}
            {maxSizeMB && <span className="rounded-full bg-surface-2 px-2.5 py-1">Maks. {maxSizeMB} MB</span>}
            <span className="inline-flex items-center gap-1 rounded-full bg-success-bg px-2.5 py-1 text-[var(--success)]"><ShieldCheck className="size-3" /> Lokal</span>
          </div>
        )}
        {hint && !validating && <p className="mt-3 max-w-sm text-[11.5px] text-muted">{hint}</p>}
      </div>
      <input ref={inputRef} type="file" accept={accept} multiple={multiple} className="hidden" onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
    </div>
  );
}
