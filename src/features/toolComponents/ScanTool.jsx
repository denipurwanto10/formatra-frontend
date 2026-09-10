import { useRef, useState } from "react";
import { Camera, ScanLine, ImagePlus } from "lucide-react";
import ToolPageHeader from "../../components/tool/ToolPageHeader";
import ResultCard from "../../components/tool/ResultCard";
import Button from "../../components/ui/Button";
import ProcessingCard from "../../components/ui/ProcessingCard";
import ErrorState from "../../components/ui/ErrorState";
import { TOOLS } from "../../lib/toolsMeta";
import { useToolProcess } from "../../hooks/useToolProcess";
import { useToast } from "../../context/ToastContext";
import { scanToPdf } from "../tools/scanToPdf";

export default function ScanTool() {
  const tool = TOOLS["scan-to-pdf"];
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [enhance, setEnhance] = useState(true);
  const { status, progress, result, error, run, reset, cancel } = useToolProcess(tool);
  const toast = useToast();
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);

  const addFiles = (fileList) => {
    const list = Array.from(fileList || []);
    if (!list.length) return;
    setFiles((prev) => [...prev, ...list]);
    setPreviews((prev) => [...prev, ...list.map((f) => URL.createObjectURL(f))]);
  };

  const removeFile = (idx) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
    setPreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleReset = () => {
    reset();
    setFiles([]);
    setPreviews([]);
  };

  const handleBuild = async () => {
    try {
      const blob = await run(
        (onProgress) => scanToPdf(files, { enhance }, onProgress),
        `${files.length} halaman pindaian`
      );
      toast.success("PDF hasil pindaian siap");
      return blob;
    } catch (e) {
      toast.error("Gagal membuat PDF", e?.message);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 lg:px-8">
      <ToolPageHeader tool={tool} />

      {status === "done" && result && (
        <ResultCard files={[{ name: "hasil-pindaian.pdf", blob: result }]} onReset={handleReset} />
      )}
      {status === "error" && <ErrorState description={error} onRetry={handleReset} />}

      {(status === "idle" || status === "processing") && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              className="flex flex-col items-center gap-2 rounded-md border-hair bg-surface px-4 py-6 text-center transition-colors hover:border-accent"
            >
              <Camera className="size-6 text-accent" />
              <span className="text-[13px] font-medium text-ink">Ambil Foto</span>
            </button>
            <button
              type="button"
              onClick={() => galleryRef.current?.click()}
              className="flex flex-col items-center gap-2 rounded-md border-hair bg-surface px-4 py-6 text-center transition-colors hover:border-accent"
            >
              <ImagePlus className="size-6 text-accent" />
              <span className="text-[13px] font-medium text-ink">Pilih dari Galeri</span>
            </button>
          </div>

          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <input
            ref={galleryRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />

          {previews.length > 0 && (
            <>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {previews.map((src, idx) => (
                  <div key={idx} className="group relative rounded-md border-hair bg-surface p-1.5">
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      aria-label={`Hapus halaman ${idx + 1}`}
                      className="absolute -right-1.5 -top-1.5 z-10 flex size-5 items-center justify-center rounded-full border-hair bg-surface text-muted opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 hover:text-[var(--danger)] focus:opacity-100"
                    >
                      ×
                    </button>
                    <img src={src} alt="" className="aspect-[3/4] w-full rounded object-cover" />
                    <span className="mt-1 block text-center font-mono text-[10px] text-muted">{idx + 1}</span>
                  </div>
                ))}
              </div>

              <label className="flex items-center gap-2 text-[12.5px] text-muted">
                <input
                  type="checkbox"
                  checked={enhance}
                  onChange={(e) => setEnhance(e.target.checked)}
                  className="accent-[var(--accent)]"
                />
                Tingkatkan kontras & hitam-putih ala hasil pindaian
              </label>

              {status === "processing" ? (
                <ProcessingCard
                  file={{
                    name: `${files.length} halaman dipindai`,
                    size: files.reduce((sum, f) => sum + f.size, 0),
                  }}
                  progress={progress}
                  label="Membuat PDF..."
                  onCancel={cancel}
                />
              ) : (
                <Button icon={ScanLine} onClick={handleBuild}>
                  Buat PDF dari {files.length} halaman
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
