import { useEffect, useState } from "react";
import { AudioLines } from "lucide-react";
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
import { compressAudio, AUDIO_BITRATE_OPTIONS } from "../tools/compressAudio";
import { formatBytes } from "../../utils/formatBytes";
import { replaceExtension } from "../../utils/download";

export default function CompressAudioTool() {
  const tool = TOOLS["compress-audio"];
  const [file, setFile] = useState(null);
  const [duration, setDuration] = useState(0);
  const [bitrate, setBitrate] = useState("96k");
  const { status, progress, result, error, run, reset, cancel } = useToolProcess(tool);
  const toast = useToast();

  useEffect(() => {
    if (!file) return;
    readVideoDuration(file)
      .then(setDuration)
      .catch(() => setDuration(0));
  }, [file]);

  const outputName = (f) => replaceExtension(f.name, "mp4");

  const handleReset = () => {
    reset();
    setFile(null);
    setDuration(0);
  };

  const handleCompress = async () => {
    try {
      const blob = await run((onProgress) => compressAudio(file, bitrate, onProgress), file.name);
      const savedPct = Math.max(0, Math.round((1 - blob.size / file.size) * 100));
      toast.success(
        "Audio berhasil dikompres",
        savedPct > 0 ? `Ukuran berkurang ${savedPct}%.` : "Ukuran file sudah cukup optimal."
      );
      return blob;
    } catch (e) {
      toast.error("Gagal mengompres audio", e?.message);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 lg:px-8">
      <ToolPageHeader tool={tool} />

      {status === "done" && result && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between rounded-md border-hair bg-surface-2 px-3 py-2 text-[12.5px]">
            <span className="text-muted">
              {formatBytes(file.size)} → <span className="text-ink">{formatBytes(result.size)}</span>
            </span>
            <span className="font-mono text-[var(--success)]">
              -{Math.max(0, Math.round((1 - result.size / file.size) * 100))}%
            </span>
          </div>
          <ResultCard files={[{ name: outputName(file), blob: result }]} onReset={handleReset} />
        </div>
      )}
      {status === "error" && <ErrorState description={error} onRetry={handleReset} />}

      {(status === "idle" || status === "processing") && (
        <div className="flex flex-col gap-4">
          {!file ? (
            <Dropzone accept={tool.accept} maxSizeMB={500} onFiles={(files) => setFile(files[0])} />
          ) : (
            <>
              {status !== "processing" && <FileListItem file={file} onRemove={handleReset} />}

              {status !== "processing" && (
                <div className="flex flex-col gap-3">
                  {AUDIO_BITRATE_OPTIONS.map((o) => (
                    <BitrateOption
                      key={o.id}
                      active={bitrate === o.id}
                      onClick={() => setBitrate(o.id)}
                      title={o.label}
                      description={o.description}
                    />
                  ))}
                  <p className="text-[12px] text-muted">
                    Video tidak di-encode ulang (stream copy) — hanya trek audio yang dikompres, jadi
                    prosesnya jauh lebih cepat daripada kompres video biasa.
                  </p>
                  <VideoProcessNotice file={file} durationSec={duration} speed="copy" />
                </div>
              )}

              {status === "processing" ? (
                <ProcessingCard file={file} progress={progress} label="Mengompres audio..." onCancel={cancel} />
              ) : (
                <Button icon={AudioLines} onClick={handleCompress}>
                  Kompres Audio
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function BitrateOption({ active, onClick, title, description }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col gap-1 rounded-md border-hair p-3 text-left transition-colors ${
        active ? "border-accent bg-surface-2" : "hover:bg-surface-2/60"
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`size-3.5 shrink-0 rounded-full border-2 ${
            active ? "border-accent bg-accent" : "border-hair"
          }`}
        />
        <span className="text-[13.5px] font-medium text-ink">{title}</span>
      </div>
      <p className="pl-[22px] text-[12.5px] text-muted">{description}</p>
    </button>
  );
}
