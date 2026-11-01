import { useState } from "react";
import ToolPageHeader from "../../components/tool/ToolPageHeader";
import ResultCard from "../../components/tool/ResultCard";
import BatchResultList from "../../components/tool/BatchResultList";
import Dropzone from "../../components/ui/Dropzone";
import FileListItem from "../../components/ui/FileListItem";
import Button from "../../components/ui/Button";
import ProcessingCard from "../../components/ui/ProcessingCard";
import ErrorState from "../../components/ui/ErrorState";
import { useToolProcess } from "../../hooks/useToolProcess";
import { useBatchProcess } from "../../hooks/useBatchProcess";
import { useToast } from "../../context/ToastContext";

/**
 * @param {object} props
 * @param {object} props.tool metadata from TOOLS
 * @param {(file:File, onProgress:(p:number)=>void) => Promise<Blob>} props.convert
 * @param {(file:File) => string} props.outputName
 * @param {string} props.actionLabel
 * @param {string} props.successMessage
 * @param {boolean} [props.batch] allow selecting & processing multiple files independently
 */
export default function SimpleConvertTool({
  tool,
  convert,
  outputName,
  actionLabel = "Konversi",
  successMessage = "Berhasil dikonversi",
  batch = false,
}) {
  const [file, setFile] = useState(null);
  const { status, progress, result, error, run, reset, cancel } = useToolProcess(tool);
  const batchProcess = useBatchProcess(convert, tool);
  const toast = useToast();

  const handleReset = () => {
    reset();
    setFile(null);
    batchProcess.reset();
  };

  const handleConvert = async () => {
    try {
      const blob = await run((onProgress) => convert(file, onProgress), file.name);
      toast.success(successMessage);
      return blob;
    } catch (e) {
      toast.error("Gagal mengonversi file", e?.message);
    }
  };

  const handleFiles = (files) => {
    if (batch && files.length > 1) {
      batchProcess.setFiles(files);
    } else {
      setFile(files[0]);
    }
  };

  const isBatchMode = batch && batchProcess.items.length > 0;

  if (isBatchMode) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-8 lg:px-8">
        <ToolPageHeader tool={tool} />
        <BatchResultList
          items={batchProcess.items}
          outputName={outputName}
          zipName={`${tool.id}-hasil.zip`}
          onRetry={batchProcess.runOne}
          onRemove={batchProcess.removeItem}
          onRunAll={batchProcess.runAll}
          isProcessing={batchProcess.isProcessing}
          overallProgress={batchProcess.overallProgress}
        />
        <Button
          variant="ghost"
          size="sm"
          className="mt-3"
          onClick={handleReset}
        >
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
              multiple={batch}
              onFiles={handleFiles}
              hint={batch ? "Bisa pilih beberapa file sekaligus untuk diproses satu per satu" : undefined}
            />
          ) : status === "processing" ? (
            <ProcessingCard file={file} progress={progress} label="Memproses file..." onCancel={cancel} />
          ) : (
            <>
              <FileListItem file={file} onRemove={handleReset} />
              <div className="mobile-action-bar sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none"><Button size="lg" className="w-full sm:w-auto" onClick={handleConvert}>{actionLabel}</Button></div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
