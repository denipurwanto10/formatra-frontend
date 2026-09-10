import { useEffect, useState } from "react";
import { Minimize2 } from "lucide-react";
import ToolPageHeader from "../../components/tool/ToolPageHeader";
import ResultCard from "../../components/tool/ResultCard";
import BatchResultList from "../../components/tool/BatchResultList";
import Dropzone from "../../components/ui/Dropzone";
import FileListItem from "../../components/ui/FileListItem";
import Button from "../../components/ui/Button";
import ProcessingCard from "../../components/ui/ProcessingCard";
import ErrorState from "../../components/ui/ErrorState";
import VideoProcessNotice from "../../components/video/VideoProcessNotice";
import { TOOLS } from "../../lib/toolsMeta";
import { useToolProcess } from "../../hooks/useToolProcess";
import { useBatchProcess } from "../../hooks/useBatchProcess";
import { useToast } from "../../context/ToastContext";
import { compressVideo, COMPRESS_LEVELS } from "../tools/compressVideo";
import { readVideoDuration } from "../tools/videoMeta";
import { formatBytes } from "../../utils/formatBytes";
import { replaceExtension } from "../../utils/download";

export default function CompressVideoTool() {
  const tool = TOOLS["compress-video"];
  const [file, setFile] = useState(null);
  const [duration, setDuration] = useState(0);
  const [level, setLevel] = useState("balanced");
  const { status, progress, result, error, run, reset, cancel } = useToolProcess(tool);
  const batchProcess = useBatchProcess((f, onProgress) => compressVideo(f, level, onProgress), tool);
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
    batchProcess.reset();
  };

  const handleCompress = async () => {
    try {
      const blob = await run((onProgress) => compressVideo(file, level, onProgress), file.name);
      const savedPct = Math.max(0, Math.round((1 - blob.size / file.size) * 100));
      toast.success(
        "Video berhasil dikompres",
        savedPct > 0 ? `Ukuran berkurang ${savedPct}%.` : "Ukuran file sudah cukup optimal."
      );
      return blob;
    } catch (e) {
      toast.error("Gagal mengompres video", e?.message);
    }
  };

  const handleFiles = (files) => {
    if (files.length > 1) {
      batchProcess.setFiles(files);
    } else {
      setFile(files[0]);
    }
  };

  const isBatchMode = batchProcess.items.length > 0;

  const levelPicker = (
    <div className="flex flex-col gap-2">
      {COMPRESS_LEVELS.map((l) => (
        <LevelOption
          key={l.id}
          active={level === l.id}
          onClick={() => setLevel(l.id)}
          title={`${l.label}${l.scale ? ` — maks. ${l.scale}p` : ""}`}
          description={l.description}
        />
      ))}
      <p className="text-[12px] text-muted">
        Prosesnya berjalan langsung di browser (ffmpeg.wasm) — bisa memakan waktu beberapa menit untuk video
        yang panjang. Hasil akhir selalu berformat MP4 (H.264 + AAC).
      </p>
    </div>
  );

  if (isBatchMode) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-8 lg:px-8">
        <ToolPageHeader tool={tool} />
        <div className="mb-4">{levelPicker}</div>
        <BatchResultList
          items={batchProcess.items}
          outputName={outputName}
          zipName="video-terkompresi.zip"
          onRetry={batchProcess.runOne}
          onRemove={batchProcess.removeItem}
          onRunAll={batchProcess.runAll}
          isProcessing={batchProcess.isProcessing}
          overallProgress={batchProcess.overallProgress}
        />
        <Button variant="ghost" size="sm" className="mt-3" onClick={handleReset}>
          Mulai batch baru
        </Button>
      </div>
    );
  }

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
            <Dropzone
              accept={tool.accept}
              multiple
              maxSizeMB={500}
              onFiles={handleFiles}
              hint="Bisa pilih beberapa video sekaligus untuk diproses satu per satu"
            />
          ) : (
            <>
              {status !== "processing" && <FileListItem file={file} onRemove={handleReset} />}
              {levelPicker}
              {status !== "processing" && (
                <VideoProcessNotice file={file} durationSec={duration} speed="encode" />
              )}
              {status === "processing" ? (
                <ProcessingCard file={file} progress={progress} label="Mengompres video..." onCancel={cancel} />
              ) : (
                <Button icon={Minimize2} onClick={handleCompress}>
                  Kompres Video
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function LevelOption({ active, onClick, title, description }) {
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
