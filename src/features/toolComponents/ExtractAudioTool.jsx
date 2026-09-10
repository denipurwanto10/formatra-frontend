import { useEffect, useMemo, useState } from "react";
import { FileAudio } from "lucide-react";
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
import { extractAudio, AUDIO_FORMATS, AUDIO_BITRATES } from "../tools/extractAudio";
import { withSuffix } from "../../utils/download";

export default function ExtractAudioTool() {
  const tool = TOOLS["extract-audio"];
  const [file, setFile] = useState(null);
  const [duration, setDuration] = useState(0);
  const [format, setFormat] = useState("mp3");
  const [bitrate, setBitrate] = useState("192k");
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

  const fmt = AUDIO_FORMATS.find((f) => f.id === format) || AUDIO_FORMATS[0];
  const outputName = (f) => withSuffix(f.name.replace(/\.[^/.]+$/, `.${fmt.ext}`), "audio");

  const handleReset = () => {
    reset();
    setFile(null);
    setDuration(0);
  };

  const handleExtract = async () => {
    try {
      const blob = await run(
        (onProgress) => extractAudio(file, { format, bitrate }, onProgress),
        file.name
      );
      toast.success("Audio berhasil diekstrak");
      return blob;
    } catch (e) {
      toast.error("Gagal mengekstrak audio", e?.message);
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
                <div className="flex flex-col gap-4 rounded-[var(--radius-md)] border-hair bg-surface p-4">
                  <Field label="Format keluaran">
                    <div className="flex gap-2 rounded-md bg-surface-2 p-1">
                      {AUDIO_FORMATS.map((f) => (
                        <button
                          key={f.id}
                          onClick={() => setFormat(f.id)}
                          className={`flex-1 rounded px-3 py-1.5 text-[13px] font-medium transition-colors ${
                            format === f.id ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </Field>

                  <Field label="Bitrate audio">
                    <div className="flex flex-wrap gap-2">
                      {AUDIO_BITRATES.map((b) => (
                        <button
                          key={b}
                          onClick={() => setBitrate(b)}
                          className={`rounded-md border-hair px-3 py-1.5 text-[13px] font-medium transition-colors ${
                            bitrate === b ? "border-accent bg-surface-2 text-accent" : "text-muted hover:bg-surface-2/60"
                          }`}
                        >
                          {b}
                        </button>
                      ))}
                    </div>
                  </Field>

                  <VideoProcessNotice file={file} durationSec={duration} speed="copy" />
                </div>
              )}

              {status === "processing" ? (
                <ProcessingCard file={file} progress={progress} label="Mengekstrak audio..." onCancel={cancel} />
              ) : (
                <Button icon={FileAudio} onClick={handleExtract}>
                  Ekstrak Audio
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
