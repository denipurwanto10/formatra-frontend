import { useEffect, useState } from "react";
import { ListOrdered, X, ChevronUp, ChevronDown, GripVertical } from "lucide-react";
import ToolPageHeader from "../../components/tool/ToolPageHeader";
import ResultCard from "../../components/tool/ResultCard";
import Dropzone from "../../components/ui/Dropzone";
import Button from "../../components/ui/Button";
import ProcessingCard from "../../components/ui/ProcessingCard";
import ErrorState from "../../components/ui/ErrorState";
import { TOOLS } from "../../lib/toolsMeta";
import { useToolProcess } from "../../hooks/useToolProcess";
import { useToast } from "../../context/ToastContext";
import { usePdfThumbnails } from "../../hooks/usePdfThumbnails";
import { reorderPdf } from "../tools/reorderPdf";

export default function ReorderTool() {
  const tool = TOOLS["reorder-pdf"];
  const [file, setFile] = useState(null);
  const [order, setOrder] = useState([]); // array of original page indices
  const { thumbs, pageCount } = usePdfThumbnails(file, 0.3);
  const { status, progress, result, error, run, reset, cancel } = useToolProcess(tool);
  const toast = useToast();

  useEffect(() => {
    if (pageCount) setOrder(Array.from({ length: pageCount }, (_, i) => i));
  }, [pageCount]);

  const handleReset = () => {
    reset();
    setFile(null);
    setOrder([]);
  };

  const move = (from, to) => {
    setOrder((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  const removePage = (position) => {
    setOrder((prev) => prev.filter((_, i) => i !== position));
  };

  const handleApply = async () => {
    if (order.length === 0) {
      toast.warning("Tidak ada halaman tersisa");
      return;
    }
    try {
      const blob = await run((onProgress) => reorderPdf(file, order, onProgress), file.name);
      toast.success("Urutan halaman berhasil disimpan");
      return blob;
    } catch {
      toast.error("Gagal menyusun ulang halaman");
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 lg:px-8">
      <ToolPageHeader tool={tool} />

      {status === "done" && result && (
        <ResultCard files={[{ name: "dokumen-tersusun.pdf", blob: result }]} onReset={handleReset} />
      )}
      {status === "error" && <ErrorState description={error} onRetry={handleReset} />}

      {(status === "idle" || status === "processing") && (
        <div className="flex flex-col gap-4">
          {!file ? (
            <Dropzone accept={tool.accept} onFiles={(fs) => setFile(fs[0])} />
          ) : (
            <>
              <div className="rounded-lg border-hair bg-surface-2 px-3 py-2 text-[12.5px] text-muted">
                <strong className="text-ink">Atur urutan halaman.</strong> Seret thumbnail, atau gunakan tombol naik/turun. Perubahan tetap di perangkat Anda.
              </div>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
                {order.map((originalIdx, position) => (
                  <div
                    key={originalIdx}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", String(position))}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      const from = Number(e.dataTransfer.getData("text/plain"));
                      move(from, position);
                    }}
                    className="group relative flex cursor-grab touch-none flex-col items-center gap-1 rounded-md border-hair bg-surface p-1.5 active:cursor-grabbing"
                  >
                    <div className="absolute left-1 top-1 z-10 flex size-5 items-center justify-center rounded bg-surface/90 text-muted">
                      <GripVertical className="size-3" aria-hidden="true" />
                    </div>
                    <div className="absolute bottom-5 left-1 z-10 flex flex-col gap-0.5 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                      {position > 0 && <button type="button" aria-label="Pindah ke atas" title="Pindah ke atas" onClick={() => move(position, position - 1)} className="flex size-6 items-center justify-center rounded bg-surface/95 text-muted shadow-sm hover:text-ink"><ChevronUp className="size-3.5" /></button>}
                      {position < order.length - 1 && <button type="button" aria-label="Pindah ke bawah" title="Pindah ke bawah" onClick={() => move(position, position + 1)} className="flex size-6 items-center justify-center rounded bg-surface/95 text-muted shadow-sm hover:text-ink"><ChevronDown className="size-3.5" /></button>}
                    </div>
                    <button
                      type="button"
                      onClick={() => removePage(position)}
                      className="absolute -right-1.5 -top-1.5 z-10 flex size-5 items-center justify-center rounded-full border-hair bg-surface text-muted opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 hover:text-[var(--danger)] focus:opacity-100"
                      aria-label="Hapus halaman"
                    >
                      <X className="size-3" />
                    </button>
                    {thumbs[originalIdx] ? (
                      <img
                        src={thumbs[originalIdx]}
                        alt={`Halaman ${originalIdx + 1}`}
                        className="aspect-[3/4] w-full rounded object-contain"
                      />
                    ) : (
                      <div className="aspect-[3/4] w-full animate-pulse rounded bg-surface-2" />
                    )}
                    <span className="font-mono text-[10px] text-muted">{position + 1}</span>
                  </div>
                ))}
              </div>

              {status === "processing" ? (
                <ProcessingCard file={file} progress={progress} label="Menyusun ulang halaman..." onCancel={cancel} />
              ) : (
                <Button icon={ListOrdered} onClick={handleApply}>
                  Simpan urutan baru
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
