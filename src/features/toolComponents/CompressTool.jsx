import { useState } from "react";
import { Minimize2 } from "lucide-react";
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
import { compressPdf } from "../tools/compressPdf";
import { formatBytes } from "../../utils/formatBytes";
import { withSuffix } from "../../utils/download";

export default function CompressTool() {
  const tool = TOOLS["compress-pdf"];
  const [file, setFile] = useState(null);
  const [level, setLevel] = useState("lossless");
  const { status, progress, result, error, run, reset, cancel } = useToolProcess(tool);
  const batchProcess = useBatchProcess((f, onProgress) => compressPdf(f, level, onProgress), tool);
  const toast = useToast();

  const outputName = (f) => withSuffix(f.name, "terkompresi");

  const handleReset = () => {
    reset();
    setFile(null);
    batchProcess.reset();
  };

  const handleCompress = async () => {
    try {
      const blob = await run((onProgress) => compressPdf(file, level, onProgress), file.name);
      const savedPct = Math.max(0, Math.round((1 - blob.size / file.size) * 100));
      toast.success(
        "PDF berhasil dikompres",
        savedPct > 0 ? `Ukuran berkurang ${savedPct}%.` : "Ukuran file sudah cukup optimal."
      );
      return blob;
    } catch {
      toast.error("Gagal mengompres PDF");
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

  if (isBatchMode) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-8 lg:px-8">
        <ToolPageHeader tool={tool} />
        <div className="mb-4 flex flex-col gap-2">
          <LevelOption
            active={level === "lossless"}
            onClick={() => setLevel("lossless")}
            title="Rendah — tanpa kehilangan kualitas"
            description="Teks tetap bisa dipilih & dicari. Penghematan ukuran biasanya kecil."
          />
          <LevelOption
            active={level === "balanced"}
            onClick={() => setLevel("balanced")}
            title="Seimbang — kompresi & kualitas seimbang"
            description="Merasterisasi halaman pada resolusi tinggi. Teks tidak lagi bisa diseleksi/dicari."
          />
          <LevelOption
            active={level === "strong"}
            onClick={() => setLevel("strong")}
            title="Kuat — ukuran paling kecil"
            description="Merasterisasi halaman pada resolusi lebih rendah. Teks tidak lagi bisa diseleksi/dicari."
          />
        </div>
        <BatchResultList
          items={batchProcess.items}
          outputName={outputName}
          zipName="pdf-terkompresi.zip"
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
          <ResultCard files={[{ name: "dokumen-terkompresi.pdf", blob: result }]} onReset={handleReset} />
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

              <div className="flex flex-col gap-2">
                <LevelOption
                  active={level === "lossless"}
                  onClick={() => setLevel("lossless")}
                  title="Rendah — tanpa kehilangan kualitas"
                  description="Merapikan struktur file. Teks tetap bisa dipilih & dicari. Penghematan ukuran biasanya kecil."
                />
                <LevelOption
                  active={level === "balanced"}
                  onClick={() => setLevel("balanced")}
                  title="Seimbang — kompresi & kualitas seimbang"
                  description="Mengubah setiap halaman menjadi gambar resolusi tinggi. Ukuran berkurang cukup besar, kualitas visual tetap tajam, tetapi teks tidak lagi bisa diseleksi/dicari."
                />
                <LevelOption
                  active={level === "strong"}
                  onClick={() => setLevel("strong")}
                  title="Kuat — ukuran paling kecil"
                  description="Mengubah setiap halaman menjadi gambar resolusi lebih rendah. Ukuran file berkurang paling signifikan, tetapi teks tidak lagi bisa diseleksi/dicari dan detail visual berkurang."
                />
              </div>
              {level !== "lossless" && (
                <p className="text-[12px] text-muted">
                  ⚠️ Mode ini merasterisasi halaman menjadi gambar — teks pada hasil akhir tidak lagi bisa diseleksi atau dicari.
                </p>
              )}

              {status === "processing" ? (
                <ProcessingCard file={file} progress={progress} label="Mengompres file..." onCancel={cancel} />
              ) : (
                <Button icon={Minimize2} onClick={handleCompress}>
                  Kompres PDF
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
