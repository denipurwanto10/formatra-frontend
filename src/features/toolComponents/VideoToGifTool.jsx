import { useEffect, useMemo, useState } from "react";
import { Film } from "lucide-react";
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
import { readVideoDuration } from "../tools/videoMeta";
import { videoToGif, GIF_MAX_DURATION } from "../tools/videoToGif";
import { withSuffix } from "../../utils/download";

function formatTime(sec) {
  if (!Number.isFinite(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function VideoToGifTool() {
  const tool = TOOLS["video-to-gif"];
  const [file, setFile] = useState(null);
  const [duration, setDuration] = useState(0);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [fps, setFps] = useState(12);
  const [width, setWidth] = useState(480);
  const [metaError, setMetaError] = useState(null);
  const { status, progress, result, error, run, reset, cancel } = useToolProcess(tool);
  const toast = useToast();

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => previewUrl && URL.revokeObjectURL(previewUrl), [previewUrl]);

  useEffect(() => {
    if (!file) return;
    setMetaError(null);
    readVideoDuration(file)
      .then((d) => {
        setDuration(d);
        setStart(0);
        setEnd(Math.min(d, GIF_MAX_DURATION));
      })
      .catch((e) => setMetaError(e?.message || "Gagal membaca durasi video."));
  }, [file]);

  const outputName = (f) => withSuffix(f.name.replace(/\.[^/.]+$/, ".gif"), "gif");

  const handleReset = () => {
    reset();
    setFile(null);
    setDuration(0);
    setStart(0);
    setEnd(0);
    setMetaError(null);
  };

  const clipLen = end - start;
  const tooLong = clipLen > GIF_MAX_DURATION + 0.1;
  const tooShort = duration > 0 && clipLen < 0.2;

  const handleConvert = async () => {
    try {
      const blob = await run(
        (onProgress) => videoToGif(file, { start, end, fps, width }, onProgress),
        file.name
      );
      toast.success("GIF berhasil dibuat");
      return blob;
    } catch (e) {
      toast.error("Gagal membuat GIF", e?.message);
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
              {metaError && <p className="text-[12.5px] text-[var(--danger)]">{metaError}</p>}

              {status !== "processing" && duration > 0 && (
                <div className="flex flex-col gap-4 rounded-[var(--radius-md)] border-hair bg-surface p-4">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[12.5px] font-medium text-muted">Potong klip untuk GIF</p>
                      <p className="font-mono text-[12px] text-ink">
                        {formatTime(start)} – {formatTime(end)}{" "}
                        <span className="text-muted">/ {formatTime(duration)}</span>
                      </p>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="flex items-center gap-2 text-[12px] text-muted">
                        Mulai
                        <input
                          type="range"
                          min={0}
                          max={duration}
                          step={0.1}
                          value={start}
                          onChange={(e) =>
                            setStart(Math.min(Number(e.target.value), end - 0.1))
                          }
                          className="w-full accent-[var(--accent)]"
                        />
                      </label>
                      <label className="flex items-center gap-2 text-[12px] text-muted">
                        Selesai
                        <input
                          type="range"
                          min={0}
                          max={duration}
                          step={0.1}
                          value={end}
                          onChange={(e) =>
                            setEnd(Math.max(Number(e.target.value), start + 0.1))
                          }
                          className="w-full accent-[var(--accent)]"
                        />
                      </label>
                    </div>
                    <p className="text-[12px] text-muted">
                      Maks. {GIF_MAX_DURATION} detik per klip supaya ukuran GIF tidak membengkak.
                    </p>
                    {tooLong && (
                      <p className="text-[12px] text-[var(--danger)]">
                        Klip terlalu panjang, persingkat maks. {GIF_MAX_DURATION} detik.
                      </p>
                    )}
                    {tooShort && (
                      <p className="text-[12px] text-[var(--danger)]">Rentang klip terlalu pendek.</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label={`Kecepatan (${fps} fps)`}>
                      <input
                        type="range"
                        min={5}
                        max={24}
                        value={fps}
                        onChange={(e) => setFps(Number(e.target.value))}
                        className="w-full accent-[var(--accent)]"
                      />
                    </Field>
                    <Field label={`Lebar (${width}px)`}>
                      <input
                        type="range"
                        min={160}
                        max={960}
                        step={40}
                        value={width}
                        onChange={(e) => setWidth(Number(e.target.value))}
                        className="w-full accent-[var(--accent)]"
                      />
                    </Field>
                  </div>

                  <VideoProcessNotice file={file} durationSec={clipLen} speed="heavy" />
                </div>
              )}

              {status === "processing" ? (
                <ProcessingCard file={file} progress={progress} label="Membuat GIF..." onCancel={cancel} />
              ) : (
                <Button icon={Film} onClick={handleConvert} disabled={!duration || tooLong || tooShort}>
                  Buat GIF
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
