import { useEffect, useMemo, useState } from "react";
import { Crop } from "lucide-react";
import ToolPageHeader from "../../components/tool/ToolPageHeader";
import ResultCard from "../../components/tool/ResultCard";
import Dropzone from "../../components/ui/Dropzone";
import FileListItem from "../../components/ui/FileListItem";
import Button from "../../components/ui/Button";
import ProcessingCard from "../../components/ui/ProcessingCard";
import ErrorState from "../../components/ui/ErrorState";
import VideoProcessNotice from "../../components/video/VideoProcessNotice";
import { TOOLS } from "../../lib/toolsMeta";
import { useToolProcess } from "../../hooks/useToolProcess";
import { useToast } from "../../context/ToastContext";
import { readVideoMeta } from "../tools/videoMeta";
import { cropVideo } from "../tools/cropVideo";
import { withSuffix } from "../../utils/download";

const PRESETS = [
  { id: "none", label: "Kustom", margins: null },
  { id: "square", label: "Persegi (tengah)", margins: null }, // computed once dims known
  { id: "wide", label: "Potong tepi", margins: { top: 8, right: 8, bottom: 8, left: 8 } },
];

export default function CropVideoTool() {
  const tool = TOOLS["crop-video"];
  const [file, setFile] = useState(null);
  const [dims, setDims] = useState(null); // {width, height, duration}
  const [margins, setMargins] = useState({ top: 8, right: 8, bottom: 8, left: 8 });
  const [preset, setPreset] = useState("wide");
  const [metaError, setMetaError] = useState(null);
  const { status, progress, result, error, run, reset, cancel } = useToolProcess(tool);
  const toast = useToast();

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => previewUrl && URL.revokeObjectURL(previewUrl), [previewUrl]);

  useEffect(() => {
    if (!file) return;
    setMetaError(null);
    readVideoMeta(file)
      .then((m) => setDims(m))
      .catch((e) => setMetaError(e?.message || "Gagal membaca dimensi video."));
  }, [file]);

  const outputName = (f) => withSuffix(f.name.replace(/\.[^/.]+$/, ".mp4"), "crop");

  const handleReset = () => {
    reset();
    setFile(null);
    setDims(null);
    setMetaError(null);
  };

  const setMargin = (key) => (e) => {
    setPreset("none");
    setMargins((m) => ({ ...m, [key]: Number(e.target.value) }));
  };

  const applyPreset = (p) => {
    setPreset(p.id);
    if (p.id === "square" && dims) {
      const { width, height } = dims;
      if (width > height) {
        const marginPct = ((width - height) / 2 / width) * 100;
        setMargins({ top: 0, bottom: 0, left: marginPct, right: marginPct });
      } else {
        const marginPct = ((height - width) / 2 / height) * 100;
        setMargins({ left: 0, right: 0, top: marginPct, bottom: marginPct });
      }
    } else if (p.margins) {
      setMargins(p.margins);
    }
  };

  const marginsValid = margins.top + margins.bottom < 90 && margins.left + margins.right < 90;

  const handleCrop = async () => {
    try {
      const blob = await run(
        (onProgress) => cropVideo(file, margins, dims, onProgress),
        file.name
      );
      toast.success("Video berhasil dipotong");
      return blob;
    } catch (e) {
      toast.error("Gagal memotong video", e?.message);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 lg:px-8">
      <ToolPageHeader tool={tool} />

      {status === "done" && result && (
        <ResultCard files={[{ name: outputName(file), blob: result }]} onReset={handleReset} />
      )}
      {status === "error" && <ErrorState description={error} onRetry={handleReset} />}

      {(status === "idle" || status === "processing") && (
        <div className="flex flex-col gap-4">
          {!file ? (
            <Dropzone accept={tool.accept} maxSizeMB={500} onFiles={(files) => setFile(files[0])} />
          ) : (
            <>
              {status !== "processing" && <FileListItem file={file} onRemove={handleReset} />}

              {previewUrl && (
                <div className="relative overflow-hidden rounded-[var(--radius-md)] border-hair bg-black">
                  <video src={previewUrl} controls={false} muted className="max-h-72 w-full opacity-70" />
                  <div
                    className="pointer-events-none absolute border-2 border-accent bg-accent/10"
                    style={{
                      top: `${margins.top}%`,
                      bottom: `${margins.bottom}%`,
                      left: `${margins.left}%`,
                      right: `${margins.right}%`,
                    }}
                  />
                </div>
              )}
              {metaError && <p className="text-[12.5px] text-[var(--danger)]">{metaError}</p>}

              {status !== "processing" && dims && (
                <div className="flex flex-col gap-4 rounded-[var(--radius-md)] border-hair bg-surface p-4">
                  <Field label="Preset">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      {PRESETS.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => applyPreset(p)}
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
                  {!marginsValid && (
                    <p className="text-[12px] text-[var(--danger)]">
                      Total margin terlalu besar, area crop jadi tidak valid.
                    </p>
                  )}

                  <VideoProcessNotice file={file} durationSec={dims.duration} speed="encode" />
                </div>
              )}

              {status === "processing" ? (
                <ProcessingCard file={file} progress={progress} label="Memotong area video..." onCancel={cancel} />
              ) : (
                <Button icon={Crop} onClick={handleCrop} disabled={!dims || !marginsValid}>
                  Potong Video
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </div>
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

function MarginSlider({ label, value, onChange }) {
  return (
    <label className="flex flex-col gap-1.5 text-[12px] text-muted">
      <span>
        {label} ({value.toFixed(0)}%)
      </span>
      <input
        type="range"
        min={0}
        max={45}
        step={1}
        value={value}
        onChange={onChange}
        className="w-full accent-[var(--accent)]"
      />
    </label>
  );
}
