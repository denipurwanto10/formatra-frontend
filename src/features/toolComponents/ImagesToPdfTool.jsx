import { useState } from "react";
import { FileOutput } from "lucide-react";
import ToolPageHeader from "../../components/tool/ToolPageHeader";
import ResultCard from "../../components/tool/ResultCard";
import Dropzone from "../../components/ui/Dropzone";
import Button from "../../components/ui/Button";
import ProcessingCard from "../../components/ui/ProcessingCard";
import ErrorState from "../../components/ui/ErrorState";
import { TOOLS } from "../../lib/toolsMeta";
import { useToolProcess } from "../../hooks/useToolProcess";
import { useToast } from "../../context/ToastContext";
import { imagesToPdf } from "../tools/imagesToPdf";

export default function ImagesToPdfTool() {
  const tool = TOOLS["image-to-pdf"];
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [pageSize, setPageSize] = useState("fit");
  const { status, progress, result, error, run, reset, cancel } = useToolProcess(tool);
  const toast = useToast();

  const addFiles = (newFiles) => {
    setFiles((prev) => [...prev, ...newFiles]);
    setPreviews((prev) => [...prev, ...newFiles.map((f) => URL.createObjectURL(f))]);
  };

  const removeFile = (idx) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
    setPreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const move = (from, to) => {
    setFiles((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
    setPreviews((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  const handleReset = () => {
    reset();
    setFiles([]);
    setPreviews([]);
  };

  const handleConvert = async () => {
    try {
      const blob = await run((onProgress) => imagesToPdf(files, { pageSize }, onProgress), `${files.length} gambar`);
      toast.success("Gambar berhasil diubah menjadi PDF");
      return blob;
    } catch {
      toast.error("Gagal mengonversi gambar");
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 lg:px-8">
      <ToolPageHeader tool={tool} />

      {status === "done" && result && (
        <ResultCard files={[{ name: "gambar-ke-pdf.pdf", blob: result }]} onReset={handleReset} />
      )}
      {status === "error" && <ErrorState description={error} onRetry={handleReset} />}

      {(status === "idle" || status === "processing") && (
        <div className="flex flex-col gap-4">
          <Dropzone accept={tool.accept} multiple onFiles={addFiles} hint="Bisa pilih beberapa gambar sekaligus" />

          {files.length > 0 && (
            <>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {previews.map((src, idx) => (
                  <div
                    key={idx}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", String(idx))}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => move(Number(e.dataTransfer.getData("text/plain")), idx)}
                    className="group relative cursor-grab rounded-md border-hair bg-surface p-1.5 active:cursor-grabbing"
                  >
                    <button
                      onClick={() => removeFile(idx)}
                      aria-label={`Hapus gambar ${idx + 1}`}
                      className="absolute -right-1.5 -top-1.5 z-10 flex size-5 items-center justify-center rounded-full border-hair bg-surface text-muted opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 hover:text-[var(--danger)] focus:opacity-100"
                    >
                      ×
                    </button>
                    <img src={src} alt="" className="aspect-square w-full rounded object-cover" />
                    <span className="mt-1 block text-center font-mono text-[10px] text-muted">{idx + 1}</span>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 rounded-md bg-surface-2 p-1">
                <button
                  onClick={() => setPageSize("fit")}
                  className={`flex-1 rounded px-3 py-1.5 text-[13px] font-medium ${
                    pageSize === "fit" ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
                  }`}
                >
                  Sesuaikan ke A4
                </button>
                <button
                  onClick={() => setPageSize("original")}
                  className={`flex-1 rounded px-3 py-1.5 text-[13px] font-medium ${
                    pageSize === "original" ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
                  }`}
                >
                  Ukuran asli gambar
                </button>
              </div>

              {status === "processing" ? (
                <ProcessingCard
                  file={{
                    name: `${files.length} gambar dipilih`,
                    size: files.reduce((sum, f) => sum + f.size, 0),
                  }}
                  progress={progress}
                  label="Membuat PDF..."
                  onCancel={cancel}
                />
              ) : (
                <Button icon={FileOutput} onClick={handleConvert}>
                  Buat PDF dari {files.length} gambar
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
