import { useState } from "react";
import JSZip from "jszip";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  RotateCcw,
  Download,
  X,
  FolderDown,
} from "lucide-react";
import Button from "../ui/Button";
import ProgressBar from "../ui/ProgressBar";
import { formatBytes } from "../../utils/formatBytes";
import { downloadBlob } from "../../utils/download";

const STATUS_ICON = {
  pending: Clock,
  processing: Loader2,
  done: CheckCircle2,
  error: XCircle,
};

const STATUS_COLOR = {
  pending: "text-muted",
  processing: "text-accent",
  done: "text-[var(--success)]",
  error: "text-[var(--danger)]",
};

/**
 * @param {object[]} items from useBatchProcess
 * @param {(file:File) => string} outputName
 * @param {string} zipName filename used for the "download all" archive
 * @param {(id:string) => void} onRetry
 * @param {(id:string) => void} onRemove
 * @param {() => void} onRunAll
 * @param {boolean} isProcessing
 * @param {number} overallProgress
 */
export default function BatchResultList({
  items,
  outputName,
  zipName = "hasil.zip",
  onRetry,
  onRemove,
  onRunAll,
  isProcessing,
  overallProgress,
}) {
  const [zipping, setZipping] = useState(false);
  const doneItems = items.filter((it) => it.status === "done" && it.result);
  const hasPending = items.some((it) => it.status === "pending");
  const hasError = items.some((it) => it.status === "error");

  const handleDownloadAll = async () => {
    setZipping(true);
    try {
      const zip = new JSZip();
      doneItems.forEach((it) => zip.file(outputName(it.file), it.result));
      const blob = await zip.generateAsync({ type: "blob" });
      downloadBlob(blob, zipName);
    } finally {
      setZipping(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-[12.5px] text-muted">
        <span>{items.length} file dipilih</span>
        <span>
          {doneItems.length} selesai{hasError ? `, ${items.filter((i) => i.status === "error").length} gagal` : ""}
        </span>
      </div>

      {(isProcessing || overallProgress > 0) && (
        <ProgressBar value={overallProgress} label="Progres keseluruhan" />
      )}

      <div className="flex flex-col gap-1.5">
        {items.map((it) => {
          const Icon = STATUS_ICON[it.status];
          return (
            <div
              key={it.id}
              className="flex items-center gap-3 rounded-md border-hair bg-surface px-3 py-2.5"
            >
              <Icon
                className={`size-4 shrink-0 ${STATUS_COLOR[it.status]} ${
                  it.status === "processing" ? "animate-spin" : ""
                }`}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-ink">{it.file.name}</p>
                {it.status === "processing" ? (
                  <div className="mt-1">
                    <ProgressBar value={it.progress} />
                  </div>
                ) : it.status === "error" ? (
                  <p className="text-[11.5px] text-[var(--danger)]">{it.error}</p>
                ) : (
                  <p className="font-mono text-[11px] text-muted">{formatBytes(it.file.size)}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {it.status === "error" && (
                  <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => onRetry(it.id)}>
                    Coba lagi
                  </Button>
                )}
                {it.status === "done" && it.result && (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={Download}
                    onClick={() => downloadBlob(it.result, outputName(it.file))}
                  >
                    Unduh
                  </Button>
                )}
                {it.status !== "processing" && onRemove && (
                  <button
                    onClick={() => onRemove(it.id)}
                    aria-label={`Hapus ${it.file.name}`}
                    className="rounded p-1 text-muted hover:bg-surface-2 hover:text-ink"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(hasPending || hasError) && (
          <Button size="sm" loading={isProcessing} onClick={onRunAll}>
            Proses Semua
          </Button>
        )}
        {doneItems.length > 1 && (
          <Button
            size="sm"
            variant="secondary"
            icon={FolderDown}
            loading={zipping}
            onClick={handleDownloadAll}
          >
            Unduh Semua (.zip)
          </Button>
        )}
      </div>
    </div>
  );
}
