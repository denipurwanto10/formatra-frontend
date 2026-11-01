import { useEffect, useState } from "react";
import { Scissors, Plus, Trash2 } from "lucide-react";
import ToolPageHeader from "../../components/tool/ToolPageHeader";
import ResultCard from "../../components/tool/ResultCard";
import Dropzone from "../../components/ui/Dropzone";
import FileListItem from "../../components/ui/FileListItem";
import Button from "../../components/ui/Button";
import ProcessingCard from "../../components/ui/ProcessingCard";
import ErrorState from "../../components/ui/ErrorState";
import { TOOLS } from "../../lib/toolsMeta";
import { useToolProcess } from "../../hooks/useToolProcess";
import { useToast } from "../../context/ToastContext";
import { splitPdfByRanges, splitPdfAllPages, zipResults } from "../tools/splitPdf";
import { loadPdfDocument } from "../../lib/pdfjs";
import { downloadBlob } from "../../utils/download";

export default function SplitTool() {
  const tool = TOOLS["split-pdf"];
  const [file, setFile] = useState(null);
  const [pageCount, setPageCount] = useState(null);
  const [mode, setMode] = useState("ranges"); // "ranges" | "all"
  const [ranges, setRanges] = useState([{ from: 1, to: 1 }]);
  const { status, progress, result, error, run, reset, cancel } = useToolProcess(tool);
  const toast = useToast();

  useEffect(() => {
    if (!file) return;
    loadPdfDocument(file).then((doc) => {
      setPageCount(doc.numPages);
      setRanges([{ from: 1, to: doc.numPages }]);
    });
  }, [file]);

  const handleReset = () => {
    reset();
    setFile(null);
    setPageCount(null);
    setRanges([{ from: 1, to: 1 }]);
  };

  const updateRange = (i, field, value) => {
    setRanges((prev) =>
      prev.map((r, idx) => (idx === i ? { ...r, [field]: Number(value) || 1 } : r))
    );
  };

  const handleSplit = async () => {
    if (mode === "ranges" && ranges.some((r) => r.from > r.to || r.from < 1 || r.to > (pageCount || 1))) {
      toast.warning("Rentang halaman tidak valid", "Pastikan halaman awal tidak lebih besar dari halaman akhir.");
      return;
    }
    try {
      await run(async (onProgress) => {
        const results =
          mode === "all"
            ? await splitPdfAllPages(file, onProgress)
            : await splitPdfByRanges(file, ranges, onProgress);
        const zip = results.length > 1 ? await zipResults(results) : null;
        return { files: results, zip };
      }, file.name);
      toast.success("PDF berhasil dipisah");
    } catch {
      toast.error("Gagal memisah PDF", "Pastikan file adalah PDF yang valid.");
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 lg:px-8">
      <ToolPageHeader tool={tool} />

      {status === "done" && result && (
        <ResultCard
          files={result.files}
          onDownloadAll={
            result.zip
              ? () => downloadBlob(result.zip, "hasil-split.zip")
              : undefined
          }
          onReset={handleReset}
        />
      )}

      {status === "error" && <ErrorState description={error} onRetry={handleReset} />}

      {(status === "idle" || status === "processing") && (
        <div className="flex flex-col gap-4">
          {!file ? (
            <Dropzone accept={tool.accept} onFiles={(fs) => setFile(fs[0])} />
          ) : (
            <>
              {status !== "processing" && <FileListItem file={file} onRemove={handleReset} />}
              {pageCount && (
                <p className="text-[13px] text-muted">
                  Dokumen ini memiliki <span className="font-mono text-ink">{pageCount}</span> halaman.
                </p>
              )}

              <div className="flex gap-2 rounded-md bg-surface-2 p-1">
                <ModeButton active={mode === "ranges"} onClick={() => setMode("ranges")}>
                  Rentang halaman
                </ModeButton>
                <ModeButton active={mode === "all"} onClick={() => setMode("all")}>
                  Pisah setiap halaman
                </ModeButton>
              </div>

              {mode === "ranges" && (
                <div className="flex flex-col gap-2">
                  {ranges.map((r, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-16 shrink-0 text-[13px] text-muted">
                        Bagian {i + 1}
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={pageCount || undefined}
                        value={r.from}
                        onChange={(e) => updateRange(i, "from", e.target.value)}
                        className="w-20 rounded-md border-hair bg-base px-2 py-1.5 text-[13px] text-ink"
                      />
                      <span className="text-muted">sampai</span>
                      <input
                        type="number"
                        min={1}
                        max={pageCount || undefined}
                        value={r.to}
                        onChange={(e) => updateRange(i, "to", e.target.value)}
                        className="w-20 rounded-md border-hair bg-base px-2 py-1.5 text-[13px] text-ink"
                      />
                      {ranges.length > 1 && (
                        <button
                          onClick={() => setRanges((prev) => prev.filter((_, idx) => idx !== i))}
                          className="ml-auto rounded p-1.5 text-muted hover:bg-surface-2 hover:text-[var(--danger)]"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Plus}
                    className="self-start"
                    onClick={() =>
                      setRanges((prev) => [...prev, { from: 1, to: pageCount || 1 }])
                    }
                  >
                    Tambah rentang
                  </Button>
                </div>
              )}

              {status === "processing" ? (
                <ProcessingCard file={file} progress={progress} label="Memisah halaman..." onCancel={cancel} />
              ) : (
                <Button icon={Scissors} onClick={handleSplit}>
                  Pisah PDF
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ModeButton({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded px-3 py-1.5 text-[13px] font-medium transition-colors ${
        active ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

