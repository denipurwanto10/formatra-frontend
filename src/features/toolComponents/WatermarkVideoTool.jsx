import { useEffect, useMemo, useState } from "react";
import { Stamp } from "lucide-react";
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
import { watermarkVideo, WATERMARK_LAYOUTS } from "../tools/watermarkVideo";
import { withSuffix } from "../../utils/download";

export default function WatermarkVideoTool() {
  const tool = TOOLS["watermark-video"];
  const [file, setFile] = useState(null);
  const [dims, setDims] = useState(null);
  const [text, setText] = useState("RAHASIA");
  const [layout, setLayout] = useState("diagonal");
  const [opacity, setOpacity] = useState(35);
  const [fontSize, setFontSize] = useState(42);
  const [color, setColor] = useState("#ffffff");
  const { status, progress, result, error, run, reset, cancel } = useToolProcess(tool);
  const toast = useToast();

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => previewUrl && URL.revokeObjectURL(previewUrl), [previewUrl]);

  useEffect(() => {
    if (!file) return;
    readVideoMeta(file)
      .then(setDims)
      .catch(() => setDims(null));
  }, [file]);

  const outputName = (f) => withSuffix(f.name.replace(/\.[^/.]+$/, ".mp4"), "watermark");

  const handleReset = () => {
    reset();
    setFile(null);
    setDims(null);
  };

  const handleApply = async () => {
    if (!text.trim()) {
      toast.warning("Isi teks watermark terlebih dahulu");
      return;
    }
    try {
      const blob = await run(
        (onProgress) =>
          watermarkVideo(
            file,
            dims,
            { text, layout, opacity: opacity / 100, fontSize, color, rotation: layout === "center" ? 0 : -35 },
            onProgress
          ),
        file.name
      );
      toast.success("Watermark berhasil ditambahkan ke video");
      return blob;
    } catch (e) {
      toast.error("Gagal menambahkan watermark", e?.message);
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
                <video
                  src={previewUrl}
                  controls
                  className="max-h-72 w-full rounded-[var(--radius-md)] border-hair bg-black"
                />
              )}

              {status !== "processing" && (
                <>
                  <Field label="Teks watermark">
                    <input
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      className="w-full rounded-md border-hair bg-base px-3 py-2 text-[13px] text-ink"
                      placeholder="mis. RAHASIA, DRAFT, CONTOH"
                    />
                  </Field>

                  <Field label="Tata letak">
                    <div className="flex gap-2 rounded-md bg-surface-2 p-1">
                      {WATERMARK_LAYOUTS.map((l) => (
                        <button
                          key={l.id}
                          onClick={() => setLayout(l.id)}
                          className={`flex-1 rounded px-3 py-1.5 text-[13px] font-medium transition-colors ${
                            layout === l.id ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
                          }`}
                        >
                          {l.label}
                        </button>
                      ))}
                    </div>
                  </Field>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label={`Transparansi (${opacity}%)`}>
                      <input
                        type="range"
                        min={5}
                        max={80}
                        value={opacity}
                        onChange={(e) => setOpacity(Number(e.target.value))}
                        className="w-full accent-[var(--accent)]"
                      />
                    </Field>
                    <Field label={`Ukuran teks (${fontSize}pt)`}>
                      <input
                        type="range"
                        min={16}
                        max={96}
                        value={fontSize}
                        onChange={(e) => setFontSize(Number(e.target.value))}
                        className="w-full accent-[var(--accent)]"
                      />
                    </Field>
                  </div>

                  <Field label="Warna teks">
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="h-9 w-16 cursor-pointer rounded-md border-hair bg-base p-1"
                    />
                  </Field>

                  <VideoProcessNotice file={file} durationSec={dims?.duration || 0} speed="encode" />
                </>
              )}

              {status === "processing" ? (
                <ProcessingCard file={file} progress={progress} label="Menambahkan watermark..." onCancel={cancel} />
              ) : (
                <Button icon={Stamp} onClick={handleApply} disabled={!dims}>
                  Tambahkan watermark
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
