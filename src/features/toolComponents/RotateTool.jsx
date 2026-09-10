import { useState } from "react";
import { RotateCw, RotateCcw as RotateCcwIcon } from "lucide-react";
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
import { rotatePdf } from "../tools/rotatePdf";
import clsx from "clsx";

export default function RotateTool() {
  const tool = TOOLS["rotate-pdf"];
  const [file, setFile] = useState(null);
  const [mode, setMode] = useState("all"); // "all" | "select"
  const [selected, setSelected] = useState(new Set());
  const [angles, setAngles] = useState({}); // per-page cumulative rotation for preview
  const { thumbs, pageCount } = usePdfThumbnails(file, 0.3);
  const { status, progress, result, error, run, reset, cancel } = useToolProcess(tool);
  const toast = useToast();

  const handleReset = () => {
    reset();
    setFile(null);
    setSelected(new Set());
    setAngles({});
  };

  const togglePage = (idx) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const rotatePreview = (idx, delta) => {
    setAngles((prev) => ({ ...prev, [idx]: ((prev[idx] || 0) + delta + 360) % 360 }));
  };

  const handleRotate = async (angle) => {
    const targets = mode === "all" ? "all" : Array.from(selected);
    if (mode === "select" && targets.length === 0) {
      toast.warning("Pilih minimal satu halaman");
      return;
    }
    try {
      const blob = await run((onProgress) => rotatePdf(file, angle, targets, onProgress), file.name);
      toast.success("PDF berhasil diputar");
      return blob;
    } catch {
      toast.error("Gagal memutar PDF");
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 lg:px-8">
      <ToolPageHeader tool={tool} />

      {status === "done" && result && (
        <ResultCard files={[{ name: "dokumen-diputar.pdf", blob: result }]} onReset={handleReset} />
      )}
      {status === "error" && <ErrorState description={error} onRetry={handleReset} />}

      {(status === "idle" || status === "processing") && (
        <div className="flex flex-col gap-4">
          {!file ? (
            <Dropzone accept={tool.accept} onFiles={(fs) => setFile(fs[0])} />
          ) : (
            <>
              <div className="flex gap-2 rounded-md bg-surface-2 p-1">
                <ModeButton active={mode === "all"} onClick={() => setMode("all")}>
                  Semua halaman
                </ModeButton>
                <ModeButton active={mode === "select"} onClick={() => setMode("select")}>
                  Pilih halaman ({selected.size})
                </ModeButton>
              </div>

              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
                {(thumbs.length ? thumbs : Array.from({ length: pageCount })).map((src, idx) => (
                  <button
                    key={idx}
                    onClick={() => mode === "select" && togglePage(idx)}
                    className={clsx(
                      "relative flex flex-col items-center gap-1 rounded-md border-hair bg-surface p-1.5 transition-colors",
                      mode === "select" && "cursor-pointer hover:border-accent/50",
                      mode === "select" && selected.has(idx) && "border-accent ring-1 ring-accent"
                    )}
                  >
                    {src ? (
                      <img
                        src={src}
                        alt={`Halaman ${idx + 1}`}
                        style={{ transform: `rotate(${angles[idx] || 0}deg)` }}
                        className="aspect-[3/4] w-full rounded object-contain transition-transform"
                      />
                    ) : (
                      <div className="aspect-[3/4] w-full animate-pulse rounded bg-surface-2" />
                    )}
                    <span className="font-mono text-[10px] text-muted">{idx + 1}</span>
                  </button>
                ))}
              </div>

              {status === "processing" ? (
                <ProcessingCard file={file} progress={progress} label="Memutar halaman..." onCancel={cancel} />
              ) : (
                <div className="flex gap-2">
                  <Button variant="secondary" icon={RotateCcwIcon} onClick={() => handleRotate(-90)}>
                    Putar kiri 90°
                  </Button>
                  <Button icon={RotateCw} onClick={() => handleRotate(90)}>
                    Putar kanan 90°
                  </Button>
                </div>
              )}
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
