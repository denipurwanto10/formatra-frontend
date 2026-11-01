import { useRef, useState } from "react";
import { PenSquare, Pen } from "lucide-react";
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
import SignaturePad from "../editor/components/SignaturePad";
import { signPdf } from "../tools/signPdf";
import { withSuffix } from "../../utils/download";

const SIG_ASPECT = 180 / 400; // matches SignaturePad's drawing canvas (w x h)
const DEFAULT_BOX = { xPct: 0.55, yPct: 0.76, wPct: 0.32 };

function clampBox(b) {
  const wPct = Math.min(Math.max(b.wPct, 0.1), 0.9);
  const hPct = wPct * SIG_ASPECT;
  return {
    wPct,
    xPct: Math.min(Math.max(b.xPct, 0), 1 - wPct),
    yPct: Math.min(Math.max(b.yPct, 0), 1 - hPct),
  };
}

export default function SignTool() {
  const tool = TOOLS["sign-pdf"];
  const [file, setFile] = useState(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [signature, setSignature] = useState(null);
  const [padOpen, setPadOpen] = useState(false);
  const [box, setBox] = useState(DEFAULT_BOX);
  const [allPages, setAllPages] = useState(false);
  const { thumbs, pageCount } = usePdfThumbnails(file, 0.7);
  const { status, progress, result, error, run, reset, cancel } = useToolProcess(tool);
  const toast = useToast();
  const stageRef = useRef(null);

  const handleReset = () => {
    reset();
    setFile(null);
    setSignature(null);
    setPageIndex(0);
    setBox(DEFAULT_BOX);
    setAllPages(false);
  };

  const startDrag = (mode) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = stageRef.current.getBoundingClientRect();
    const start = e.touches ? e.touches[0] : e;
    const startX = start.clientX;
    const startY = start.clientY;
    const startBox = box;

    const onMove = (ev) => {
      const point = ev.touches ? ev.touches[0] : ev;
      const dxPct = (point.clientX - startX) / rect.width;
      const dyPct = (point.clientY - startY) / rect.height;
      if (mode === "move") {
        setBox(clampBox({ ...startBox, xPct: startBox.xPct + dxPct, yPct: startBox.yPct + dyPct }));
      } else {
        setBox(clampBox({ ...startBox, wPct: startBox.wPct + dxPct }));
      }
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);
  };

  const handleApply = async () => {
    try {
      const blob = await run(
        (onProgress) =>
          signPdf(
            file,
            {
              pageIndex,
              image: signature,
              xPct: box.xPct,
              yPct: box.yPct,
              wPct: box.wPct,
              hPct: box.wPct * SIG_ASPECT,
              allPages,
            },
            onProgress
          ),
        file.name
      );
      toast.success("Tanda tangan berhasil ditambahkan");
      return blob;
    } catch (e) {
      toast.error("Gagal menandatangani PDF", e?.message);
    }
  };

  const activeThumb = thumbs[pageIndex];
  const hPct = box.wPct * SIG_ASPECT;

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 lg:px-8">
      <ToolPageHeader tool={tool} />

      {status === "done" && result && (
        <ResultCard files={[{ name: withSuffix(file.name, "ttd"), blob: result }]} onReset={handleReset} />
      )}
      {status === "error" && <ErrorState description={error} onRetry={handleReset} />}

      {(status === "idle" || status === "processing") && (
        <div className="flex flex-col gap-4">
          {!file ? (
            <Dropzone accept={tool.accept} onFiles={(fs) => setFile(fs[0])} />
          ) : !signature ? (
            <div className="flex flex-col items-center gap-3 rounded-md border-hair bg-surface-2 px-4 py-10 text-center">
              <p className="text-[13px] text-muted">Buat tanda tangan Anda terlebih dahulu.</p>
              <Button icon={Pen} onClick={() => setPadOpen(true)}>
                Gambar Tanda Tangan
              </Button>
            </div>
          ) : (
            <>
              {activeThumb && (
                <div
                  ref={stageRef}
                  className="relative mx-auto select-none overflow-hidden rounded-md border-hair bg-white"
                  style={{ width: "100%", maxWidth: 420 }}
                >
                  <img src={activeThumb} alt="Pratinjau halaman" className="pointer-events-none block w-full" draggable={false} />
                  <div
                    onMouseDown={startDrag("move")}
                    onTouchStart={startDrag("move")}
                    className="absolute cursor-move border-2 border-accent bg-white/40"
                    style={{
                      left: `${box.xPct * 100}%`,
                      top: `${box.yPct * 100}%`,
                      width: `${box.wPct * 100}%`,
                      height: `${hPct * 100}%`,
                    }}
                  >
                    <img
                      src={signature}
                      alt="Tanda tangan"
                      className="pointer-events-none h-full w-full object-contain"
                      draggable={false}
                    />
                    <div
                      onMouseDown={startDrag("resize")}
                      onTouchStart={startDrag("resize")}
                      className="absolute -bottom-1.5 -right-1.5 size-3.5 cursor-nwse-resize rounded-full border-2 border-accent bg-surface"
                    />
                  </div>
                </div>
              )}
              <p className="text-center text-[11.5px] text-muted">Seret untuk memindahkan, tarik titik sudut untuk mengubah ukuran.</p>

              {pageCount > 1 && !allPages && (
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

              {pageCount > 1 && (
                <label className="flex items-center gap-2 text-[12.5px] text-muted">
                  <input
                    type="checkbox"
                    checked={allPages}
                    onChange={(e) => setAllPages(e.target.checked)}
                    className="accent-[var(--accent)]"
                  />
                  Terapkan di posisi yang sama pada semua halaman
                </label>
              )}

              <Button variant="secondary" size="sm" icon={Pen} onClick={() => setPadOpen(true)}>
                Gambar ulang tanda tangan
              </Button>

              {status === "processing" ? (
                <ProcessingCard file={file} progress={progress} label="Menandatangani PDF..." onCancel={cancel} />
              ) : (
                <Button icon={PenSquare} onClick={handleApply}>
                  Terapkan Tanda Tangan
                </Button>
              )}
            </>
          )}
        </div>
      )}

      <SignaturePad open={padOpen} onClose={() => setPadOpen(false)} onConfirm={(dataUrl) => setSignature(dataUrl)} />
    </div>
  );
}
