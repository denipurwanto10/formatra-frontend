import { useState } from "react";
import { GitCompare, ChevronDown, ChevronUp } from "lucide-react";
import ToolPageHeader from "../../components/tool/ToolPageHeader";
import Dropzone from "../../components/ui/Dropzone";
import FileListItem from "../../components/ui/FileListItem";
import Button from "../../components/ui/Button";
import ProcessingCard from "../../components/ui/ProcessingCard";
import ErrorState from "../../components/ui/ErrorState";
import { TOOLS } from "../../lib/toolsMeta";
import { useToolProcess } from "../../hooks/useToolProcess";
import { useToast } from "../../context/ToastContext";
import { comparePdfs } from "../tools/comparePdf";

export default function CompareTool() {
  const tool = TOOLS["compare-pdf"];
  const [fileA, setFileA] = useState(null);
  const [fileB, setFileB] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [expanded, setExpanded] = useState({});
  const { status, progress, result, error, run, reset, cancel } = useToolProcess(tool);
  const toast = useToast();

  const handleReset = () => {
    reset();
    setFileA(null);
    setFileB(null);
    setShowAll(false);
    setExpanded({});
  };

  const handleCompare = async () => {
    try {
      const out = await run(
        (onProgress) => comparePdfs(fileA, fileB, onProgress),
        `${fileA.name} vs ${fileB.name}`
      );
      if (out.diffPageCount === 0) {
        toast.success("Kedua PDF identik secara teks");
      } else {
        toast.success(`${out.diffPageCount} halaman berbeda ditemukan`);
      }
    } catch (e) {
      toast.error("Gagal membandingkan PDF", e?.message);
    }
  };

  const toggleExpand = (pageNumber) => setExpanded((e) => ({ ...e, [pageNumber]: !e[pageNumber] }));

  const visiblePages = result ? result.pages.filter((p) => showAll || !p.same) : [];

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 lg:px-8">
      <ToolPageHeader tool={tool} />

      {status === "error" && <ErrorState description={error} onRetry={handleReset} />}

      {status === "done" && result && (
        <div className="flex flex-col gap-3">
          <div className="rounded-md border-hair bg-surface-2 px-3.5 py-3 text-[12.5px] text-muted">
            <span className="font-medium text-ink">{fileA.name}</span> ({result.pageCountA} hlm) vs{" "}
            <span className="font-medium text-ink">{fileB.name}</span> ({result.pageCountB} hlm) —{" "}
            {result.diffPageCount === 0 ? (
              <span className="text-[var(--success)]">tidak ada perbedaan teks</span>
            ) : (
              <span>{result.diffPageCount} halaman berbeda</span>
            )}
          </div>

          {result.diffPageCount > 0 && (
            <label className="flex items-center gap-2 text-[12.5px] text-muted">
              <input
                type="checkbox"
                checked={showAll}
                onChange={(e) => setShowAll(e.target.checked)}
                className="accent-[var(--accent)]"
              />
              Tampilkan juga halaman yang sama
            </label>
          )}

          <div className="flex flex-col gap-2">
            {visiblePages.map((p) => (
              <div key={p.pageNumber} className="rounded-md border-hair bg-surface">
                <button
                  type="button"
                  onClick={() => toggleExpand(p.pageNumber)}
                  className="flex w-full items-center justify-between px-3.5 py-2.5 text-left"
                >
                  <span className="text-[13px] font-medium text-ink">
                    Halaman {p.pageNumber}
                    {!p.existsInA && " (hanya ada di file kedua)"}
                    {!p.existsInB && " (hanya ada di file pertama)"}
                  </span>
                  <span className="flex items-center gap-2">
                    <span
                      className={`text-[11px] font-medium ${
                        p.same ? "text-[var(--success)]" : "text-[var(--danger)]"
                      }`}
                    >
                      {p.same ? "Sama" : "Berbeda"}
                    </span>
                    {expanded[p.pageNumber] ? (
                      <ChevronUp className="size-4 text-muted" />
                    ) : (
                      <ChevronDown className="size-4 text-muted" />
                    )}
                  </span>
                </button>
                {expanded[p.pageNumber] && (
                  <div className="border-t border-hair px-3.5 py-3 text-[12.5px] leading-relaxed">
                    {p.same && <p className="text-muted">Teks halaman ini identik di kedua file.</p>}
                    {!p.same && p.tooLarge && (
                      <p className="text-muted">
                        Halaman ini terlalu panjang untuk ditampilkan kata per kata, tapi isinya
                        terdeteksi berbeda.
                      </p>
                    )}
                    {!p.same && !p.tooLarge && p.ops && (
                      <p className="whitespace-pre-wrap">
                        {p.ops.map((op, idx) => {
                          if (op.type === "equal") return <span key={idx}>{op.value} </span>;
                          if (op.type === "remove")
                            return (
                              <span key={idx} className="bg-[var(--danger-bg)] text-[var(--danger)] line-through">
                                {op.value}{" "}
                              </span>
                            );
                          return (
                            <span key={idx} className="bg-[var(--success-bg)] text-[var(--success)]">
                              {op.value}{" "}
                            </span>
                          );
                        })}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          <Button variant="ghost" size="sm" onClick={handleReset}>
            Bandingkan file lain
          </Button>
        </div>
      )}

      {(status === "idle" || status === "processing") && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <span className="text-[12.5px] font-medium text-muted">File pertama</span>
              {!fileA ? (
                <Dropzone accept={tool.accept} onFiles={(fs) => setFileA(fs[0])} />
              ) : (
                <FileListItem file={fileA} onRemove={() => setFileA(null)} />
              )}
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-[12.5px] font-medium text-muted">File kedua</span>
              {!fileB ? (
                <Dropzone accept={tool.accept} onFiles={(fs) => setFileB(fs[0])} />
              ) : (
                <FileListItem file={fileB} onRemove={() => setFileB(null)} />
              )}
            </div>
          </div>

          {fileA && fileB && (
            status === "processing" ? (
              <ProcessingCard
                file={{ name: `${fileA.name} vs ${fileB.name}`, size: fileA.size + fileB.size }}
                progress={progress}
                label="Membandingkan isi PDF..."
                onCancel={cancel}
              />
            ) : (
              <Button icon={GitCompare} onClick={handleCompare}>
                Bandingkan
              </Button>
            )
          )}
        </div>
      )}
    </div>
  );
}
