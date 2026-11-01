import { useState } from "react";
import { Crop } from "lucide-react";
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
import { cropPdf } from "../tools/cropPdf";
import { withSuffix } from "../../utils/download";

const PRESETS = [
  { id: "none", label: "Kustom", margins: null },
  { id: "slim", label: "Rapikan tepi tipis", margins: { top: 3, right: 3, bottom: 3, left: 3 } },
  { id: "wide", label: "Potong margin lebar", margins: { top: 10, right: 10, bottom: 10, left: 10 } },
];

export default function CropTool() {
  const tool = TOOLS["crop-pdf"];
  const [file, setFile] = useState(null);
  const [preset, setPreset] = useState("slim");
  const [margins, setMargins] = useState(PRESETS[1].margins);
  const { thumbs } = usePdfThumbnails(file, 0.35);
  const { status, progress, result, error, run, reset, cancel } = useToolProcess(tool);
  const toast = useToast();

  const handleReset = () => {
    reset();
    setFile(null);
  };

  const setMargin = (key) => (e) => {
    setPreset("none");
    setMargins((m) => ({ ...m, [key]: Number(e.target.value) }));
  };

  const handleCrop = async () => {
    try {
      const blob = await run((onProgress) => cropPdf(file, margins, "all", onProgress), file.name);
      toast.success("PDF berhasil dipotong");
      return blob;
    } catch (e) {
      toast.error("Gagal memotong PDF", e?.message);
    }
  };

  const previewSrc = thumbs[0];

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 lg:px-8">
      <ToolPageHeader tool={tool} />

      {status === "done" && result && (
        <ResultCard
          files={[{ name: withSuffix(file.name, "dipotong"), blob: result }]}
          onReset={handleReset}
        />
      )}
      {status === "error" && <ErrorState description={error} onRetry={handleReset} />}

      {(status === "idle" || status === "processing") && (
        <div className="flex flex-col gap-4">
          {!file ? (
            <Dropzone accept={tool.accept} onFiles={(fs) => setFile(fs[0])} />
          ) : (
            <>
              {previewSrc && (
                <div className="flex justify-center rounded-md border-hair bg-surface p-4">
                  <div className="relative w-40 overflow-hidden">
                    <img src={previewSrc} alt="Pratinjau halaman" className="w-full opacity-40" />
                    <div
                      className="absolute border-2 border-accent bg-accent/10"
                      style={{
                        top: `${margins.top}%`,
                        bottom: `${margins.bottom}%`,
                        left: `${margins.left}%`,
                        right: `${margins.right}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              <Field label="Preset">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {PRESETS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setPreset(p.id);
                        if (p.margins) setMargins(p.margins);
                      }}
                      className={`rounded-md border-hair px-2 py-2 text-[12px] font-medium transition-colors ${
                        preset === p.id ? "border-accent bg-accent/5 text-ink" : "text-muted hover:text-ink"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </Field>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <MarginSlider label="Atas" value={margins.top} onChange={setMargin("top")} />
                <MarginSlider label="Bawah" value={margins.bottom} onChange={setMargin("bottom")} />
                <MarginSlider label="Kiri" value={margins.left} onChange={setMargin("left")} />
                <MarginSlider label="Kanan" value={margins.right} onChange={setMargin("right")} />
              </div>

              {status === "processing" ? (
                <ProcessingCard file={file} progress={progress} label="Memotong halaman..." onCancel={cancel} />
              ) : (
                <Button icon={Crop} onClick={handleCrop}>
                  Potong semua halaman
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MarginSlider({ label, value, onChange }) {
  return (
    <Field label={`${label} (${value}%)`}>
      <input
        type="range"
        min={0}
        max={40}
        value={value}
        onChange={onChange}
        className="w-full accent-[var(--accent)]"
      />
    </Field>
  );
}

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12.5px] font-medium text-muted">{label}</label>
      {children}
    </div>
  );
}
