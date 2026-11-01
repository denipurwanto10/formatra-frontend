import { useEffect, useMemo, useState } from "react";
import { Gauge } from "lucide-react";
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
import { changeVideoSpeed, SPEED_PRESETS } from "../tools/videoSpeed";
import { withSuffix } from "../../utils/download";

export default function VideoSpeedTool() {
  const tool = TOOLS["video-speed"];
  const [file, setFile] = useState(null);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const { status, progress, result, error, run, reset, cancel } = useToolProcess(tool);
  const toast = useToast();

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => previewUrl && URL.revokeObjectURL(previewUrl), [previewUrl]);

  useEffect(() => {
    if (!file) return;
    readVideoDuration(file)
      .then(setDuration)
      .catch(() => setDuration(0));
  }, [file]);

  const outputName = (f) => withSuffix(f.name.replace(/\.[^/.]+$/, ".mp4"), `${speed}x`);

  const handleReset = () => {
    reset();
    setFile(null);
    setDuration(0);
    setSpeed(1);
  };

  const handleApply = async () => {
    try {
      const blob = await run((onProgress) => changeVideoSpeed(file, speed, onProgress), file.name);
      toast.success("Kecepatan video berhasil diubah");
      return blob;
    } catch (e) {
      toast.error("Gagal mengubah kecepatan video", e?.message);
    }
  };

  const resultDuration = duration > 0 ? duration / speed : 0;

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
                <div className="flex flex-col gap-4 rounded-[var(--radius-md)] border-hair bg-surface p-4">
                  <div className="flex flex-col gap-1.5">
                    <p className="text-[12.5px] font-medium text-muted">Kecepatan</p>
                    <div className="flex flex-wrap gap-2">
                      {SPEED_PRESETS.map((s) => (
                        <button
                          key={s}
                          onClick={() => setSpeed(s)}
                          className={`rounded-md border-hair px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                            speed === s ? "border-accent bg-surface-2 text-accent" : "text-muted hover:bg-surface-2/60"
                          }`}
                        >
                          {s}×{s < 1 ? " (slow-mo)" : s > 1 ? "" : ""}
                        </button>
                      ))}
                    </div>
                    {duration > 0 && (
                      <p className="text-[12px] text-muted">
                        Durasi asli {duration.toFixed(1)}s → hasil sekitar {resultDuration.toFixed(1)}s.
                      </p>
                    )}
                  </div>

                  <VideoProcessNotice file={file} durationSec={duration} speed="encode" />
                </div>
              )}

              {status === "processing" ? (
                <ProcessingCard file={file} progress={progress} label="Mengubah kecepatan video..." onCancel={cancel} />
              ) : (
                <Button icon={Gauge} onClick={handleApply}>
                  Terapkan Kecepatan
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
