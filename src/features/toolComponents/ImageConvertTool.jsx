import { useState } from "react";
import { RefreshCw } from "lucide-react";
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
import { convertImage, guessDefaultTarget, IMAGE_FORMATS } from "../tools/convertImage";
import { replaceExtension } from "../../utils/download";

export default function ImageConvertTool() {
  const tool = TOOLS["convert-image"];
  const [file, setFile] = useState(null);
  const [target, setTarget] = useState("png");
  const { status, progress, result, error, run, reset, cancel } = useToolProcess(tool);
  const batchProcess = useBatchProcess((f, onProgress) => convertImage(f, target, onProgress), tool);
  const toast = useToast();

  const outputName = (f) => replaceExtension(f.name, target === "jpg" ? "jpg" : target);

  const handleReset = () => {
    reset();
    setFile(null);
    batchProcess.reset();
  };

  const handleConvert = async () => {
    try {
      const blob = await run((onProgress) => convertImage(file, target, onProgress), file.name);
      toast.success(`Gambar berhasil diubah ke ${target.toUpperCase()}`);
      return blob;
    } catch (e) {
      toast.error("Gagal mengonversi gambar", e?.message);
    }
  };

  const handleFiles = (files) => {
    if (files.length > 1) {
      batchProcess.setFiles(files);
    } else {
      setFile(files[0]);
      setTarget(guessDefaultTarget(files[0]));
    }
  };

  const isBatchMode = batchProcess.items.length > 0;

  const formatPicker = (
    <div className="flex flex-col gap-1.5">
      <p className="text-[12.5px] font-medium text-muted">Ubah menjadi:</p>
      <div className="flex flex-wrap gap-2">
        {IMAGE_FORMATS.map((f) => (
          <button
            key={f.id}
            onClick={() => setTarget(f.id)}
            className={`rounded-md border-hair px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
              target === f.id ? "border-accent bg-surface-2 text-accent" : "text-muted hover:bg-surface-2/60"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  );

  if (isBatchMode) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-8 lg:px-8">
        <ToolPageHeader tool={tool} />
        <div className="mb-4">{formatPicker}</div>
        <BatchResultList
          items={batchProcess.items}
          outputName={outputName}
          zipName={`gambar-${target}.zip`}
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
        <ResultCard files={[{ name: outputName(file), blob: result }]} onReset={handleReset} />
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
              {formatPicker}
              {status === "processing" ? (
                <ProcessingCard file={file} progress={progress} label="Mengonversi gambar..." onCancel={cancel} />
              ) : (
                <Button icon={RefreshCw} onClick={handleConvert}>
                  Konversi ke {target.toUpperCase()}
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
