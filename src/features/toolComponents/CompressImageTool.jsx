import { useState } from "react";
import { ImageDown } from "lucide-react";
import ToolPageHeader from "../../components/tool/ToolPageHeader";
import ResultCard from "../../components/tool/ResultCard";
import BatchResultList from "../../components/tool/BatchResultList";
import Dropzone from "../../components/ui/Dropzone";
import FileListItem from "../../components/ui/FileListItem";
import Button from "../../components/ui/Button";
import ProcessingCard from "../../components/ui/ProcessingCard";
import ErrorState from "../../components/ui/ErrorState";
import { TOOLS } from "../../lib/toolsMeta";
import { useToolProcess } from "../../hooks/useToolProcess";
import { useBatchProcess } from "../../hooks/useBatchProcess";
import { useToast } from "../../context/ToastContext";
import { compressImage, extFromFormat, guessSourceFormat, MAX_DIMENSION_PRESETS } from "../tools/compressImage";
import { formatBytes } from "../../utils/formatBytes";
import { replaceExtension } from "../../utils/download";

const FORMAT_OPTIONS = [
  { id: "png", label: "PNG" },
  { id: "jpg", label: "JPG" },
  { id: "webp", label: "WEBP" },
];

export default function CompressImageTool() {
  const tool = TOOLS["compress-image"];
  const [file, setFile] = useState(null);
  const [format, setFormat] = useState("png");
  const [quality, setQuality] = useState(75);
  const [maxDimension, setMaxDimension] = useState(null);

  const options = { format, quality: quality / 100, maxDimension };
  const process = (f, onProgress) => compressImage(f, { ...options, format: format || guessSourceFormat(f) }, onProgress);

  const { status, progress, result, error, run, reset, cancel } = useToolProcess(tool);
  const batchProcess = useBatchProcess(process, tool);
  const toast = useToast();

  const outputName = (f) => replaceExtension(f.name, extFromFormat(format));

  const handleReset = () => {
    reset();
    setFile(null);
    batchProcess.reset();
  };

  const handleCompress = async () => {
    try {
      const blob = await run((onProgress) => process(file, onProgress), file.name);
      const savedPct = Math.max(0, Math.round((1 - blob.size / file.size) * 100));
      toast.success(
        "Gambar berhasil dikompres",
        savedPct > 0 ? `Ukuran berkurang ${savedPct}%.` : "Ukuran file sudah cukup optimal."
      );
      return blob;
    } catch (e) {
      toast.error("Gagal mengompres gambar", e?.message);
    }
  };

  const handleFiles = (files) => {
    if (files.length > 1) {
      batchProcess.setFiles(files);
      setFormat(guessSourceFormat(files[0]));
    } else {
      setFile(files[0]);
      setFormat(guessSourceFormat(files[0]));
    }
  };

  const isBatchMode = batchProcess.items.length > 0;

  const controls = (
    <div className="flex flex-col gap-4">
      <Field label="Format keluaran">
        <div className="flex gap-2 rounded-md bg-surface-2 p-1">
          {FORMAT_OPTIONS.map((f) => (
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={`Kualitas (${quality}%)`}>
          <input
            type="range"
            min={10}
            max={100}
            step={5}
            value={quality}
            onChange={(e) => setQuality(Number(e.target.value))}
            className="w-full accent-[var(--accent)]"
          />
          {format === "png" && (
            <p className="text-[11.5px] text-muted">
              Untuk PNG, kualitas lebih rendah mengurangi jumlah warna agar file lebih kecil.
            </p>
          )}
        </Field>
        <Field label="Ukuran maksimum">
          <select
            value={maxDimension ?? "original"}
            onChange={(e) => {
              const preset = MAX_DIMENSION_PRESETS.find((p) => p.id === e.target.value);
              setMaxDimension(preset?.value ?? null);
            }}
            className="w-full rounded-md border-hair bg-base px-3 py-2 text-[13px] text-ink"
          >
            {MAX_DIMENSION_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </div>
  );

  if (isBatchMode) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-8 lg:px-8">
        <ToolPageHeader tool={tool} />
        <div className="mb-4">{controls}</div>
        <BatchResultList
          items={batchProcess.items}
          outputName={outputName}
          zipName={`gambar-kompresi-${format}.zip`}
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
              onFiles={handleFiles}
              hint="Bisa pilih beberapa file sekaligus untuk diproses satu per satu"
            />
          ) : (
            <>
              {status !== "processing" && <FileListItem file={file} onRemove={handleReset} />}
              {controls}
              {status === "processing" ? (
                <ProcessingCard file={file} progress={progress} label="Mengompres gambar..." onCancel={cancel} />
              ) : (
                <Button icon={ImageDown} onClick={handleCompress}>
                  Kompres Gambar
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
