import { useState } from "react";
import { FileText, Copy, Download, RotateCcw, Info } from "lucide-react";
import ToolPageHeader from "../../components/tool/ToolPageHeader";
import Dropzone from "../../components/ui/Dropzone";
import FileListItem from "../../components/ui/FileListItem";
import Button from "../../components/ui/Button";
import ProcessingCard from "../../components/ui/ProcessingCard";
import ErrorState from "../../components/ui/ErrorState";
import { TOOLS } from "../../lib/toolsMeta";
import { useToolProcess } from "../../hooks/useToolProcess";
import { useToast } from "../../context/ToastContext";
import { pdfToTxt } from "../tools/pdfToTxt";
import { downloadBlob, replaceExtension } from "../../utils/download";

export default function PdfToTxtTool() {
  const tool = TOOLS["pdf-to-txt"];
  const [file, setFile] = useState(null);
  const { status, progress, result, error, run, reset, cancel } = useToolProcess(tool);
  const toast = useToast();

  const handleReset = () => {
    reset();
    setFile(null);
  };

  const handleExtract = async () => {
    try {
      const out = await run((onProgress) => pdfToTxt(file, onProgress), file.name);
      if (!out.hasTextLayer) {
        toast.warning(
          "Tidak ada teks yang ditemukan",
          "Dokumen ini kemungkinan hasil pindaian (scan). Gunakan tool OCR PDF terlebih dahulu."
        );
      } else {
        toast.success("Teks berhasil diekstrak");
      }
    } catch {
      toast.error("Gagal mengekstrak teks");
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(result.text);
      toast.success("Teks disalin ke clipboard");
    } catch {
      toast.error("Gagal menyalin", "Coba salin manual dari kotak teks.");
    }
  };

  const handleDownload = () => {
    const blob = new Blob([result.text], { type: "text/plain;charset=utf-8" });
    downloadBlob(blob, replaceExtension(file.name, "txt"));
  };

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 lg:px-8">
      <ToolPageHeader tool={tool} />

      {status === "error" && <ErrorState description={error} onRetry={handleReset} />}

      {status === "done" && result && (
        <div className="flex flex-col gap-3">
          {!result.hasTextLayer && (
            <div className="flex gap-2.5 rounded-md border-hair bg-surface-2 px-3.5 py-3">
              <Info className="mt-0.5 size-4 shrink-0 text-accent" />
              <p className="text-[12.5px] leading-relaxed text-muted">
                Tidak ditemukan lapisan teks di dokumen ini — kemungkinan hasil pindaian (scan).
                Gunakan tool <strong>OCR PDF</strong> untuk mengubahnya menjadi teks yang bisa dicari.
              </p>
            </div>
          )}
          <textarea
            readOnly
            value={result.text || "(Tidak ada teks yang ditemukan)"}
            rows={16}
            className="w-full resize-y rounded-md border-hair bg-surface px-3 py-2.5 font-mono text-[12.5px] leading-relaxed text-ink outline-none"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" icon={Copy} variant="secondary" onClick={handleCopy} disabled={!result.text}>
              Salin teks
            </Button>
            <Button size="sm" icon={Download} onClick={handleDownload} disabled={!result.text}>
              Unduh .txt
            </Button>
            <Button size="sm" icon={RotateCcw} variant="ghost" onClick={handleReset}>
              Proses file lain
            </Button>
          </div>
        </div>
      )}

      {(status === "idle" || status === "processing") && (
        <div className="flex flex-col gap-4">
          {!file ? (
            <Dropzone accept={tool.accept} onFiles={(fs) => setFile(fs[0])} />
          ) : (
            <>
              {status !== "processing" && <FileListItem file={file} onRemove={handleReset} />}
              {status === "processing" ? (
                <ProcessingCard file={file} progress={progress} label="Mengekstrak teks..." onCancel={cancel} />
              ) : (
                <Button icon={FileText} onClick={handleExtract}>
                  Ekstrak Teks
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
