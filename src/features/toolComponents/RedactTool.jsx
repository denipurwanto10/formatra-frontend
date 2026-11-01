import { useRef, useState } from "react";
import { EyeOff, Trash2 } from "lucide-react";
import ToolPageHeader from "../../components/tool/ToolPageHeader";
import ResultCard from "../../components/tool/ResultCard";
import Dropzone from "../../components/ui/Dropzone";
import Button from "../../components/ui/Button";
import ProcessingCard from "../../components/ui/ProcessingCard";
import ErrorState from "../../components/ui/ErrorState";
import { TOOLS } from "../../lib/toolsMeta";
import { useToolProcess } from "../../hooks/useToolProcess";
import { useToast } from "../../context/ToastContext";
import { usePdfThumbnails } from "../../hooks/usePdfThumbnails";
import { redactPdf } from "../tools/redactPdf";
import { withSuffix } from "../../utils/download";

function toBox(draft) {
  return {
    xPct: Math.min(draft.x0, draft.x1),
    yPct: Math.min(draft.y0, draft.y1),
    wPct: Math.abs(draft.x1 - draft.x0),
    hPct: Math.abs(draft.y1 - draft.y0),
  };
}

export default function RedactTool() {
  const tool = TOOLS["redact-pdf"];
  const [file, setFile] = useState(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [boxesByPage, setBoxesByPage] = useState({});
  const [draft, setDraft] = useState(null);
  const { thumbs, pageCount } = usePdfThumbnails(file, 0.9);
  const { status, progress, result, error, run, reset, cancel } = useToolProcess(tool);
  const toast = useToast();
  const stageRef = useRef(null);

  const handleReset = () => {
    reset();
    setFile(null);
    setPageIndex(0);
    setBoxesByPage({});
    setDraft(null);
  };

  const totalBoxes = Object.values(boxesByPage).reduce((sum, arr) => sum + arr.length, 0);

  const pointToPct = (e) => {
    const rect = stageRef.current.getBoundingClientRect();
    const point = e.touches ? e.touches[0] : e;
    return {
      x: Math.min(Math.max((point.clientX - rect.left) / rect.width, 0), 1),
      y: Math.min(Math.max((point.clientY - rect.top) / rect.height, 0), 1),
    };
  };

  const startDraw = (e) => {
    e.preventDefault();
    const start = pointToPct(e);
    setDraft({ x0: start.x, y0: start.y, x1: start.x, y1: start.y });

    const onMove = (ev) => {
      const p = pointToPct(ev);
      setDraft((d) => (d ? { ...d, x1: p.x, y1: p.y } : d));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
      setDraft((d) => {
        if (!d) return null;
        const box = toBox(d);
        if (box.wPct > 0.015 && box.hPct > 0.01) {
          setBoxesByPage((prev) => ({
            ...prev,
            [pageIndex]: [...(prev[pageIndex] || []), box],
          }));
        }
        return null;
      });
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);
  };

  const removeBox = (idx) => {
    setBoxesByPage((prev) => ({
      ...prev,
      [pageIndex]: (prev[pageIndex] || []).filter((_, i) => i !== idx),
    }));
  };

  const clearPage = () => setBoxesByPage((prev) => ({ ...prev, [pageIndex]: [] }));

  const handleRedact = async () => {
    if (totalBoxes === 0) {
      toast.error("Belum ada area yang ditandai", "Gambar kotak di atas bagian yang ingin disamarkan.");
      return;
    }
    try {
      const blob = await run((onProgress) => redactPdf(file, boxesByPage, onProgress), file.name);
      toast.success("PDF berhasil disamarkan");
      return blob;
    } catch (e) {
      toast.error("Gagal menyamarkan PDF", e?.message);
    }
  };

  const activeThumb = thumbs[pageIndex];
  const pageBoxes = boxesByPage[pageIndex] || [];
  const draftBox = draft && toBox(draft);

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 lg:px-8">
      <ToolPageHeader tool={tool} />

      {status === "done" && result && (
        <ResultCard files={[{ name: withSuffix(file.name, "disamarkan"), blob: result }]} onReset={handleReset} />
      )}
      {status === "error" && <ErrorState description={error} onRetry={handleReset} />}

      {(status === "idle" || status === "processing") && (
        <div className="flex flex-col gap-4">
          {!file ? (
            <Dropzone accept={tool.accept} onFiles={(fs) => setFile(fs[0])} />
          ) : (
            <>
              <div className="rounded-md border-hair bg-surface-2 px-3.5 py-3">
                <p className="text-[12.5px] leading-relaxed text-muted">
                  Seret pada pratinjau untuk menggambar kotak di atas bagian yang ingin
                  disamarkan. Halaman akan dirender ulang sebagai gambar, jadi teks di baliknya
                  benar-benar hilang — bukan cuma tertutup kotak hitam.
                </p>
              </div>

              {activeThumb && (
                <div
                  ref={stageRef}
                  onMouseDown={startDraw}
                  onTouchStart={startDraw}
                  className="relative mx-auto touch-none select-none overflow-hidden rounded-md border-hair bg-white"
                  style={{ width: "100%", maxWidth: 460, cursor: "crosshair" }}
                >
                  <img
                    src={activeThumb}
                    alt="Pratinjau halaman"
                    className="pointer-events-none block w-full"
                    draggable={false}
                  />
                  {pageBoxes.map((b, idx) => (
                    <div
                      key={idx}
                      className="group absolute bg-black"
                      style={{
                        left: `${b.xPct * 100}%`,
                        top: `${b.yPct * 100}%`,
                        width: `${b.wPct * 100}%`,
                        height: `${b.hPct * 100}%`,
                      }}
                    >
                      <button
                        type="button"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          removeBox(idx);
                        }}
                        aria-label="Hapus kotak"
                        className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full border border-white bg-[var(--danger)] text-[9px] leading-none text-white opacity-0 group-hover:opacity-100"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {draftBox && (
                    <div
                      className="absolute bg-black/60"
                      style={{
                        left: `${draftBox.xPct * 100}%`,
                        top: `${draftBox.yPct * 100}%`,
                        width: `${draftBox.wPct * 100}%`,
                        height: `${draftBox.hPct * 100}%`,
                      }}
                    />
                  )}
                </div>
              )}

              {pageCount > 1 && (
                <div className="flex items-center justify-center gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pageIndex === 0}
                    onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                  >
                    ← Sebelumnya
                  </Button>
                  <span className="text-[12.5px] text-muted">
                    Halaman {pageIndex + 1} dari {pageCount}
                    {pageBoxes.length > 0 ? ` · ${pageBoxes.length} area` : ""}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pageIndex === pageCount - 1}
                    onClick={() => setPageIndex((p) => Math.min(pageCount - 1, p + 1))}
                  >
                    Berikutnya →
                  </Button>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-[12px] text-muted">{totalBoxes} area ditandai di seluruh dokumen</span>
                {pageBoxes.length > 0 && (
                  <Button variant="ghost" size="sm" icon={Trash2} onClick={clearPage}>
                    Hapus di halaman ini
                  </Button>
                )}
              </div>

              {status === "processing" ? (
                <ProcessingCard file={file} progress={progress} label="Menyamarkan & merender ulang halaman..." onCancel={cancel} />
              ) : (
                <Button icon={EyeOff} onClick={handleRedact}>
                  Samarkan & Simpan
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
