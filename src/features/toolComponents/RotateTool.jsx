import { useState } from "react";
import { RotateCw, RotateCcw as RotateCcwIcon, Check, Undo2 } from "lucide-react";
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
  const [angles, setAngles] = useState({}); // per-page pending rotation — preview only, nothing written to the file yet
  const { thumbs, pageCount } = usePdfThumbnails(file, 0.3);
  const { status, progress, result, error, run, reset, cancel } = useToolProcess(tool);
  const toast = useToast();

  const hasPendingRotation = Object.values(angles).some((a) => a % 360 !== 0);

  const handleReset = () => {
    reset();
    setFile(null);
    setSelected(new Set());
    setAngles({});
  };

  const togglePage = (idx) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  // Rotating only updates the on-screen preview (thumbnails spin via CSS) —
  // the PDF itself isn't touched, so the user can keep nudging pages 90° at
  // a time, switch selection, or reset, and only pay the processing cost
  // once they're happy and press "Terapkan & Unduh".
  const previewRotate = (delta) => {
    const targets =
      mode === "all" ? Array.from({ length: pageCount || thumbs.length }, (_, i) => i) : Array.from(selected);
    if (mode === "select" && targets.length === 0) {
      toast.warning("Pilih minimal satu halaman");
      return;
    }
    setAngles((prev) => {
      const next = { ...prev };
      targets.forEach((idx) => {
        next[idx] = ((next[idx] || 0) + delta + 360) % 360;
      });
      return next;
    });
  };

  const clearPreview = () => setAngles({});

  const handleApply = async () => {
    if (!hasPendingRotation) {
      toast.warning("Putar dulu halaman yang diinginkan, lalu terapkan");
      return;
    }
    try {
      const blob = await run((onProgress) => rotatePdf(file, angles, onProgress), file.name);
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
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <Button variant="secondary" icon={RotateCcwIcon} onClick={() => previewRotate(-90)}>
                      Putar kiri 90°
                    </Button>
                    <Button variant="secondary" icon={RotateCw} onClick={() => previewRotate(90)}>
                      Putar kanan 90°
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      icon={Undo2}
                      onClick={clearPreview}
                      disabled={!hasPendingRotation}
                    >
                      Atur ulang
                    </Button>
                    <Button icon={Check} onClick={handleApply} disabled={!hasPendingRotation}>
                      Terapkan &amp; Unduh
                    </Button>
                  </div>
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
