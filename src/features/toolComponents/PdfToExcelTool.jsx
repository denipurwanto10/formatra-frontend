import { useState } from "react";
import { FileSpreadsheet } from "lucide-react";
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
import { pdfToExcel } from "../tools/pdfToExcel";
import { replaceExtension } from "../../utils/download";

export default function PdfToExcelTool() {
  const tool = TOOLS["pdf-to-excel"];
  const [file, setFile] = useState(null);
  const { status, progress, result, error, run, reset, cancel } = useToolProcess(tool);
  const batchProcess = useBatchProcess((f, onProgress) => pdfToExcel(f, {}, onProgress), tool);
  const toast = useToast();

  const outputName = (f) => replaceExtension(f.name, "xlsx");

  const handleReset = () => {
    reset();
    setFile(null);
    batchProcess.reset();
  };

  const handleConvert = async () => {
    try {
      const blob = await run((onProgress) => pdfToExcel(file, {}, onProgress), file.name);
      toast.success("PDF berhasil dikonversi ke Excel");
      return blob;
    } catch (e) {
      toast.error("Gagal mengonversi PDF ke Excel", e?.message);
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
        <BatchResultList
          items={batchProcess.items}
          outputName={outputName}
          zipName="pdf-ke-excel.zip"
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

              {status === "processing" ? (
                <ProcessingCard file={file} progress={progress} label="Mengonversi PDF ke Excel..." onCancel={cancel} />
              ) : (
                <Button icon={FileSpreadsheet} onClick={handleConvert}>
                  Konversi ke Excel
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}