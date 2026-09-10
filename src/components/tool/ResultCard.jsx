import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Download, RotateCcw, Maximize2, FileText } from "lucide-react";
import Button from "../ui/Button";
import Modal from "../ui/Modal";
import PdfPreview from "./PdfPreview";
import { formatBytes } from "../../utils/formatBytes";
import { downloadBlob } from "../../utils/download";

function isPreviewable(blob) {
  return blob.type === "application/pdf" || blob.type.startsWith("image/") || blob.type.startsWith("video/");
}

function downloadOne(f) {
  downloadBlob(f.blob, f.name);
}

/**
 * @param {{name:string, blob:Blob}[]} files
 */
export default function ResultCard({ title = "Berhasil diproses", files, onDownloadAll, onReset }) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const totalSize = files.reduce((sum, f) => sum + (f.blob?.size || 0), 0);
  const isSingle = files.length === 1;
  const singleFile = isSingle ? files[0] : null;
  const singlePreviewable = singleFile && isPreviewable(singleFile.blob);

  return (
    <div className="animate-pop-in flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--success)]/25 bg-[var(--success-bg)] p-5">
      {/* Status header — unambiguous success state, always the first thing seen */}
      <div className="flex items-center gap-3">
        <div className="success-pop flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--success)]/15 text-[var(--success)] ring-1 ring-inset ring-[var(--success)]/10">
          <CheckCircle2 className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-ink">{title}</p>
          <p className="text-[12px] text-muted">
            {files.length} file &middot; {formatBytes(totalSize)}
          </p>
        </div>
      </div>

      {/* Inline preview — part of the workflow, not hidden behind a click */}
      {singlePreviewable && <InlinePreview file={singleFile} onExpand={() => setPreviewOpen(true)} />}

      {/* Multi-file output: a compact, scannable list */}
      {!isSingle && (
        <div className="flex flex-col gap-2">
          {files.map((f, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-xl border-hair bg-surface px-3 py-2.5 shadow-soft"
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <FileText className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-ink">{f.name}</p>
                <p className="font-mono text-[11px] text-muted">{formatBytes(f.blob.size)}</p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                icon={Download}
                className="shrink-0"
                onClick={() => downloadOne(f)}
              >
                Unduh
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Primary CTA — the download action is the point of this card */}
      <div className="mobile-action-bar flex flex-col gap-2 border-t border-[var(--success)]/20 pt-3.5 sm:flex-row sm:flex-wrap sm:items-center">
        {isSingle ? (
          <Button
  size="lg"
  icon={Download}
  className="w-full min-w-0 shadow-none hover:shadow-none sm:w-auto"
  onClick={() => downloadOne(singleFile)}
>
  <span className="min-w-0 truncate">
    Unduh {singleFile.name}
  </span>
</Button>
        ) : (
          onDownloadAll && (
            <Button size="lg" icon={Download} className="w-full shadow-none hover:shadow-none sm:w-auto" onClick={onDownloadAll}>
              Unduh semua (.zip)
            </Button>
          )
        )}
        <Button
          size="lg"
          variant="ghost"
          icon={RotateCcw}
          className="w-full shadow-none hover:shadow-none sm:w-auto"
          onClick={onReset}
        >
          Proses file lain
        </Button>
      </div>

      {singlePreviewable && (
        <PreviewModal open={previewOpen} file={singleFile} onClose={() => setPreviewOpen(false)} />
      )}
    </div>
  );
}

/** Inline preview shown directly in the result card — no click required to
 * see the outcome for PDFs and images. A "Perbesar" affordance still opens
 * the full modal for a closer look. */
function InlinePreview({ file, onExpand }) {
  const url = useMemo(() => URL.createObjectURL(file.blob), [file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  const isPdf = file.blob.type === "application/pdf";
  const isVideo = file.blob.type.startsWith("video/");

  return (
    <div className="group relative overflow-hidden rounded-[var(--radius-md)] border-hair bg-surface">
      {isPdf ? (
        <PdfPreview file={file.blob} heightClass="h-64 sm:h-80" />
      ) : isVideo ? (
        <video src={url} controls className="max-h-64 w-full bg-black sm:max-h-80" />
      ) : (
        <img
          src={url}
          alt={`Pratinjau ${file.name}`}
          className="max-h-64 w-full object-contain sm:max-h-80"
        />
      )}
      <button
        type="button"
        onClick={onExpand}
        className="absolute right-5 top-2 flex min-h-9 max-w-[calc(100%-1rem)] items-center justify-center gap-1.5 rounded-md border border-accent bg-accent px-2.5 py-2 text-[11.5px] font-semibold leading-none text-white shadow-none transition-colors hover:bg-[var(--accent-strong)] sm:right-5 sm:top-3 sm:px-3"
      >
        <Maximize2 className="size-3.5" />
        Perbesar
      </button>
    </div>
  );
}

function PreviewModal({ open, file, onClose }) {
  const url = useMemo(() => (file ? URL.createObjectURL(file.blob) : null), [file]);

  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  if (!file) return null;

  const isPdf = file.blob.type === "application/pdf";
  const isVideo = file.blob.type.startsWith("video/");

  return (
    <Modal open={open} onClose={onClose} title={file.name} width={isPdf ? 1080 : 760}>
      <div className="flex flex-col gap-4">
        {isPdf ? (
          <PdfPreview file={file.blob} heightClass="h-[60vh] sm:h-[70vh] rounded-xl border-hair" />
        ) : isVideo ? (
          <video src={url} controls autoPlay className="max-h-[70vh] w-full rounded-xl border-hair bg-black" />
        ) : (
          <img
            src={url}
            alt={`Pratinjau ${file.name}`}
            className="max-h-[70vh] w-full rounded-xl border-hair object-contain"
          />
        )}
        <div className="flex justify-end">
          <Button size="sm" icon={Download} onClick={() => downloadOne(file)}>
            Unduh
          </Button>
        </div>
      </div>
    </Modal>
  );
}
