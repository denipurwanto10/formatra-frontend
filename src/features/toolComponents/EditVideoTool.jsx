import { useEffect, useMemo, useState } from "react";
import { Clapperboard, RotateCw, Volume2, VolumeX } from "lucide-react";
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
import { editVideo, readVideoDuration, ROTATE_OPTIONS } from "../tools/editVideo";
import { withSuffix } from "../../utils/download";

function formatTime(sec) {
  if (!Number.isFinite(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function EditVideoTool() {
  const tool = TOOLS["edit-video"];
  const [file, setFile] = useState(null);
  const [duration, setDuration] = useState(0);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [rotate, setRotate] = useState(0);
  const [mute, setMute] = useState(false);
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
        setEnd(d);
      })
      .catch((e) => setMetaError(e?.message || "Gagal membaca durasi video."));
  }, [file]);

  const outputName = (f) => withSuffix(f.name.replace(/\.[^/.]+$/, ".mp4"), "edit");

  const handleReset = () => {
    reset();
    setFile(null);
    setDuration(0);
    setStart(0);
    setEnd(0);
    setRotate(0);
    setMute(false);
    setMetaError(null);
  };

  const handleEdit = async () => {
    try {
      const blob = await run(
        (onProgress) => editVideo(file, { start, end: end || null, rotate, mute }, onProgress),
        file.name
      );
      toast.success("Video berhasil diedit");
      return blob;
    } catch (e) {
      toast.error("Gagal mengedit video", e?.message);
    }
  };

  const isTrimmed = duration > 0 && (start > 0 || end < duration);
  const trimTooShort = duration > 0 && end - start < 0.2;

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
                  {/* Trim */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[12.5px] font-medium text-muted">Potong durasi</p>
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
                          onChange={(e) => setStart(Math.min(Number(e.target.value), end - 0.1))}
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
                          onChange={(e) => setEnd(Math.max(Number(e.target.value), start + 0.1))}
                          className="w-full accent-[var(--accent)]"
                        />
                      </label>
                    </div>
                    {trimTooShort && (
                      <p className="text-[12px] text-[var(--danger)]">Rentang potong terlalu pendek.</p>
                    )}
                  </div>

                  {/* Rotate */}
                  <div className="flex flex-col gap-1.5">
                    <p className="text-[12.5px] font-medium text-muted">Putar orientasi</p>
                    <div className="flex flex-wrap gap-2">
                      {ROTATE_OPTIONS.map((deg) => (
                        <button
                          key={deg}
                          onClick={() => setRotate(deg)}
                          className={`flex items-center gap-1.5 rounded-md border-hair px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                            rotate === deg ? "border-accent bg-surface-2 text-accent" : "text-muted hover:bg-surface-2/60"
                          }`}
                        >
                          <RotateCw className="size-3.5" style={{ transform: `rotate(${deg}deg)` }} />
                          {deg}°
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Mute */}
                  <button
                    onClick={() => setMute((m) => !m)}
                    className={`flex w-fit items-center gap-1.5 rounded-md border-hair px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                      mute ? "border-accent bg-surface-2 text-accent" : "text-muted hover:bg-surface-2/60"
                    }`}
                  >
                    {mute ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
                    {mute ? "Audio dibisukan" : "Bisukan audio"}
                  </button>

                  <VideoProcessNotice file={file} durationSec={Math.max(0, end - start)} speed="encode" />
                </div>
              )}

              {status === "processing" ? (
                <ProcessingCard file={file} progress={progress} label="Mengedit video..." onCancel={cancel} />
              ) : (
                <Button icon={Clapperboard} onClick={handleEdit} disabled={!duration || trimTooShort}>
                  {isTrimmed || rotate || mute ? "Terapkan & Proses" : "Proses Video"}
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
