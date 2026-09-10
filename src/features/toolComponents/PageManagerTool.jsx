import { useState } from "react";
import { Trash2, FileOutput } from "lucide-react";
import clsx from "clsx";
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
import { deletePages, extractPages, pagesOutputName } from "../tools/managePages";

export default function PageManagerTool() {
  const tool = TOOLS["manage-pages"];
  const [file, setFile] = useState(null);
  const [mode, setMode] = useState("delete"); // "delete" | "extract"
  const [selected, setSelected] = useState(new Set());
  const { thumbs, pageCount } = usePdfThumbnails(file, 0.3);
  const { status, progress, result, error, run, reset, cancel } = useToolProcess(tool);
  const toast = useToast();

  const handleReset = () => {
    reset();
    setFile(null);
    setSelected(new Set());
  };

  const togglePage = (idx) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(Array.from({ length: pageCount }, (_, i) => i)));
  const clearAll = () => setSelected(new Set());

  const handleRun = async () => {
    if (selected.size === 0) {
      toast.warning(
        mode === "delete" ? "Pilih halaman yang ingin dihapus" : "Pilih halaman yang ingin diekstrak"
      );
      return;
    }
    try {
      const indices = Array.from(selected).sort((a, b) => a - b);
      const blob = await run((onProgress) =>
        mode === "delete"
          ? deletePages(file, indices, onProgress)
          : extractPages(file, indices, onProgress),
        file.name
      );
      toast.success(mode === "delete" ? "Halaman berhasil dihapus" : "Halaman berhasil diekstrak");
      return blob;
    } catch (e) {
      toast.error("Gagal memproses halaman", e?.message);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 lg:px-8">
      <ToolPageHeader tool={tool} />

      {status === "done" && result && (
        <ResultCard files={[{ name: pagesOutputName(file.name, mode), blob: result }]} onReset={handleReset} />
      )}
      {status === "error" && <ErrorState description={error} onRetry={handleReset} />}

      {(status === "idle" || status === "processing") && (
        <div className="flex flex-col gap-4">
          {!file ? (
            <Dropzone accept={tool.accept} onFiles={(fs) => setFile(fs[0])} />
          ) : (
            <>
              <div className="rounded-lg border-hair bg-surface-2 px-3 py-2 text-[12.5px] text-muted">
                <strong className="text-ink">Pilih halaman</strong> untuk menghapus atau mengekstraknya. Ketuk thumbnail untuk memilih.
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex gap-2 rounded-md bg-surface-2 p-1">
                  <ModeButton active={mode === "delete"} onClick={() => setMode("delete")}>
                    Hapus halaman
                  </ModeButton>
                  <ModeButton active={mode === "extract"} onClick={() => setMode("extract")}>
                    Ekstrak halaman
                  </ModeButton>
                </div>
                <div className="flex items-center gap-3 text-[12.5px] text-muted">
                  <span>{selected.size} dipilih</span>
                  <button onClick={selectAll} className="text-accent hover:underline">
                    Pilih semua
                  </button>
                  <button onClick={clearAll} className="text-accent hover:underline">
                    Kosongkan
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
                {(thumbs.length ? thumbs : Array.from({ length: pageCount })).map((src, idx) => (
                  <button
                    key={idx}
                    onClick={() => togglePage(idx)}
                    aria-pressed={selected.has(idx)}
                    aria-label={`Halaman ${idx + 1}${selected.has(idx) ? ", dipilih" : ""}`}
                    className={clsx(
                      "relative flex flex-col items-center gap-1 rounded-md border-hair bg-surface p-1.5 transition-colors",
                      "cursor-pointer hover:border-accent/50",
                      selected.has(idx) && "border-accent ring-1 ring-accent"
                    )}
                  >
                    {selected.has(idx) && (
                      <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-accent-ink">
                        ✓
                      </span>
                    )}
                    {src ? (
                      <img
                        src={src}
                        alt={`Halaman ${idx + 1}`}
                        className="aspect-[3/4] w-full rounded object-contain"
                      />
                    ) : (
                      <div className="aspect-[3/4] w-full animate-pulse rounded bg-surface-2" />
                    )}
                    <span className="font-mono text-[10px] text-muted">{idx + 1}</span>
                  </button>
                ))}
              </div>

              <div className="sticky bottom-2 z-20 -mx-1 rounded-lg border-hair bg-surface/95 p-1.5 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-surface/85">
                {status === "processing" ? (
                  <ProcessingCard
                    file={file}
                    progress={progress}
                    label={mode === "delete" ? "Menghapus halaman..." : "Mengekstrak halaman..."}
                    onCancel={cancel}
                  />
                ) : mode === "delete" ? (
                  <Button variant="danger" icon={Trash2} onClick={handleRun} className="w-full">
                    Hapus {selected.size || ""} halaman terpilih
                  </Button>
                ) : (
                  <Button icon={FileOutput} onClick={handleRun} className="w-full">
                    Ekstrak {selected.size || ""} halaman terpilih
                  </Button>
                )}
              </div>


            </>
          )}
        </div>
      )}
    </div>
  );
}

function ModeButton({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded px-3 py-1.5 text-[13px] font-medium transition-colors ${
        active ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
