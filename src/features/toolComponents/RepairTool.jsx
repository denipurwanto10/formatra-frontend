import { useState } from "react";
import { Wrench, CheckCircle2, AlertTriangle, Download, RotateCcw } from "lucide-react";
import ToolPageHeader from "../../components/tool/ToolPageHeader";
import Dropzone from "../../components/ui/Dropzone";
import FileListItem from "../../components/ui/FileListItem";
import Button from "../../components/ui/Button";
import ProcessingCard from "../../components/ui/ProcessingCard";
import ErrorState from "../../components/ui/ErrorState";
import { TOOLS } from "../../lib/toolsMeta";
import { useToolProcess } from "../../hooks/useToolProcess";
import { useToast } from "../../context/ToastContext";
import { repairPdf } from "../tools/repairPdf";
import { withSuffix, downloadBlob } from "../../utils/download";
import { formatBytes } from "../../utils/formatBytes";

export default function RepairTool() {
  const tool = TOOLS["repair-pdf"];
  const [file, setFile] = useState(null);
  const { status, progress, result, error, run, reset, cancel } = useToolProcess(tool);
  const toast = useToast();

  const handleReset = () => {
    reset();
    setFile(null);
  };

  const handleRepair = async () => {
    try {
      const outcome = await run((onProgress) => repairPdf(file, onProgress), file.name);
      if (outcome.skipped.length > 0) {
        toast.warning(
          `Dipulihkan ${outcome.recovered}/${outcome.total} halaman`,
          `Halaman ${outcome.skipped.join(", ")} tidak dapat dipulihkan dan dilewati.`
        );
      } else {
        toast.success("PDF berhasil diperbaiki", "Semua halaman berhasil dipulihkan.");
      }
      return outcome;
    } catch (e) {
      toast.error("Gagal memperbaiki PDF", e?.message);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 lg:px-8">
      <ToolPageHeader tool={tool} />

      {status === "done" && result && <RepairResult file={file} outcome={result} onReset={handleReset} />}
      {status === "error" && <ErrorState description={error} onRetry={handleReset} />}

      {(status === "idle" || status === "processing") && (
        <div className="flex flex-col gap-4">
          {!file ? (
            <Dropzone
              accept={tool.accept}
              onFiles={(fs) => setFile(fs[0])}
              hint="Cocok untuk PDF yang gagal dibuka, rusak sebagian, atau ditolak aplikasi lain."
            />
          ) : (
            <>
              {status !== "processing" && <FileListItem file={file} onRemove={handleReset} />}
              {status === "processing" ? (
                <ProcessingCard file={file} progress={progress} label="Menganalisis & membangun ulang dokumen..." onCancel={cancel} />
              ) : (
                <Button icon={Wrench} onClick={handleRepair}>
                  Perbaiki PDF
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function RepairResult({ file, outcome, onReset }) {
  const hasSkipped = outcome.skipped.length > 0;
  const name = withSuffix(file.name, "diperbaiki");

  const download = () => {
    downloadBlob(outcome.blob, name);
  };

  return (
    <div
      className={`flex flex-col gap-4 rounded-lg border-hair p-5 ${
        hasSkipped ? "bg-[var(--warning-bg)]" : "bg-[var(--success-bg)]"
      }`}
    >
      <div className="flex items-center gap-2.5">
        {hasSkipped ? (
          <AlertTriangle className="size-5 shrink-0 text-[var(--warning)]" />
        ) : (
          <CheckCircle2 className="size-5 shrink-0 text-[var(--success)]" />
        )}
        <p className="text-[13.5px] font-medium text-ink">
          {hasSkipped
            ? `Dipulihkan ${outcome.recovered} dari ${outcome.total} halaman`
            : `Semua ${outcome.total} halaman berhasil dipulihkan`}
        </p>
      </div>

      {hasSkipped && (
        <p className="text-[12.5px] leading-relaxed text-muted">
          Halaman berikut rusak parah dan tidak bisa dipulihkan, sehingga dilewati:{" "}
          <span className="font-mono">{outcome.skipped.join(", ")}</span>.
        </p>
      )}

      <div className="flex items-center justify-between gap-3 rounded-md border-hair bg-surface px-3 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-ink">{name}</p>
          <p className="font-mono text-[11px] text-muted">{formatBytes(outcome.blob.size)}</p>
        </div>
        <Button size="sm" variant="secondary" icon={Download} onClick={download}>
          Unduh
        </Button>
      </div>

      <Button size="sm" variant="ghost" icon={RotateCcw} onClick={onReset}>
        Proses file lain
      </Button>
    </div>
  );
}
