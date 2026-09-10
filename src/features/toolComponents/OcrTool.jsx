import { useRef, useState } from "react";
import { ScanText } from "lucide-react";
import ToolPageHeader from "../../components/tool/ToolPageHeader";
import ResultCard from "../../components/tool/ResultCard";
import Dropzone from "../../components/ui/Dropzone";
import FileListItem from "../../components/ui/FileListItem";
import Button from "../../components/ui/Button";
import ProcessingCard from "../../components/ui/ProcessingCard";
import ErrorState from "../../components/ui/ErrorState";
import { TOOLS } from "../../lib/toolsMeta";
import { useToast } from "../../context/ToastContext";
import { ocrToSearchablePdf } from "../tools/ocrPdf";
import { replaceExtension } from "../../utils/download";
import { addHistoryEntry } from "../../lib/history";

const LANGUAGES = [
  { code: "ind", label: "Indonesia" },
  { code: "eng", label: "English" },
];

export default function OcrTool() {
  const tool = TOOLS["ocr-pdf"];
  const [file, setFile] = useState(null);
  const [selectedLangs, setSelectedLangs] = useState(["ind", "eng"]);
  const [status, setStatus] = useState("idle"); // idle | processing | done | error
  const [progressInfo, setProgressInfo] = useState({ page: 0, total: 0, progress: 0 });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const toast = useToast();
  const cancelledRef = useRef(false);

  const toggleLang = (code) => {
    setSelectedLangs((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const handleReset = () => {
    cancelledRef.current = false;
    setStatus("idle");
    setResult(null);
    setError(null);
    setFile(null);
    setProgressInfo({ page: 0, total: 0, progress: 0 });
  };

  const handleCancel = () => {
    cancelledRef.current = true;
    setStatus("idle");
    setProgressInfo({ page: 0, total: 0, progress: 0 });
  };

  const handleRun = async () => {
    if (selectedLangs.length === 0) {
      toast.error("Pilih minimal satu bahasa OCR");
      return;
    }
    cancelledRef.current = false;
    setStatus("processing");
    setError(null);
    try {
      const out = await ocrToSearchablePdf(file, { languages: selectedLangs }, (info) => {
        if (!cancelledRef.current) setProgressInfo(info);
      });
      if (cancelledRef.current) return;
      setResult(out);
      setStatus("done");
      addHistoryEntry({ toolId: tool.id, toolName: tool.name, fileName: file.name });
      toast.success("OCR selesai", "Dokumen sekarang bisa dicari dan diseleksi teksnya.");
    } catch (err) {
      if (cancelledRef.current) return;
      console.error(err);
      setError(err?.message || "Gagal memproses OCR. Coba file lain.");
      setStatus("error");
      toast.error("Gagal memproses OCR");
    }
  };

  const overallPct = progressInfo.total
    ? Math.round(((progressInfo.page - 1 + progressInfo.progress) / progressInfo.total) * 100)
    : 0;

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 lg:px-8">
      <ToolPageHeader tool={tool} />

      {status === "done" && result && (
        <ResultCard
          files={[{ name: replaceExtension(file.name, "pdf").replace(/\.pdf$/, "-ocr.pdf"), blob: result.blob }]}
          onReset={handleReset}
        />
      )}
      {status === "error" && <ErrorState description={error} onRetry={handleReset} />}

      {(status === "idle" || status === "processing") && (
        <div className="flex flex-col gap-4">
          {!file ? (
            <Dropzone accept={tool.accept} onFiles={(fs) => setFile(fs[0])} hint="PDF atau gambar (JPG/PNG)" />
          ) : (
            <>
              {status !== "processing" && <FileListItem file={file} onRemove={handleReset} />}

              {status === "idle" && (
                <div>
                  <p className="mb-1.5 text-[12.5px] font-medium text-ink">Bahasa OCR</p>
                  <div className="flex flex-wrap gap-2">
                    {LANGUAGES.map((l) => (
                      <button
                        key={l.code}
                        onClick={() => toggleLang(l.code)}
                        className={`rounded-md border-hair px-3 py-1.5 text-[13px] transition-colors ${
                          selectedLangs.includes(l.code)
                            ? "border-accent bg-surface-2 text-ink"
                            : "text-muted hover:bg-surface-2/60"
                        }`}
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {status === "processing" ? (
                <ProcessingCard
                  file={file}
                  progress={overallPct}
                  label={
                    progressInfo.total
                      ? `Memproses halaman ${progressInfo.page} dari ${progressInfo.total}...`
                      : "Menyiapkan mesin OCR..."
                  }
                  onCancel={handleCancel}
                />
              ) : (
                <Button icon={ScanText} onClick={handleRun}>
                  Mulai OCR
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
