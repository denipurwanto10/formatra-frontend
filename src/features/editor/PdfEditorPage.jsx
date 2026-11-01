import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Download } from "lucide-react";
import ToolPageHeader from "../../components/tool/ToolPageHeader";
import Dropzone from "../../components/ui/Dropzone";
import Spinner from "../../components/ui/Spinner";
import Button from "../../components/ui/Button";
import { TOOLS } from "../../lib/toolsMeta";
import { loadPdfDocument } from "../../lib/pdfjs";
import { useEditorStore } from "./useEditorStore";
import { CanvasProvider } from "./CanvasContext";
import { uid } from "../../utils/id";
import { downloadBlob } from "../../utils/download";
import ThumbnailSidebar from "./components/ThumbnailSidebar";
import EditorToolbar from "./components/EditorToolbar";
import PropertiesPanel from "./components/PropertiesPanel";
import PdfCanvas from "./components/PdfCanvas";
import SignaturePad from "./components/SignaturePad";
import FindReplaceBar from "./components/FindReplaceBar";
import { exportEditedPdf } from "./pdfExport";
import { useCanvasHandle } from "./CanvasContext";
import { useToast } from "../../context/ToastContext";
import { addHistoryEntry } from "../../lib/history";
import { ocrToSearchablePdf } from "../tools/ocrPdf";
import { clearPageTextCache } from "./pageTextCache";
import { appendPdfPages } from "./pdfPageOps";
import { loadAutosaveSnapshot, clearAutosaveSnapshot } from "./autosaveDb";
import { RotateCcw, Trash2 as TrashIcon, Loader2, Check, AlertCircle } from "lucide-react";

function ScannedPdfBanner({ scannedPageCount, totalPages, onRunOcr, ocrState }) {
  if (!scannedPageCount) return null;
  const allScanned = scannedPageCount === totalPages;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-hair bg-[var(--warning-bg)] px-4 py-2.5 text-[12.5px] text-ink">
      <p className="leading-snug">
        {allScanned
          ? "Dokumen ini tampaknya hasil pindai (scan) tanpa lapisan teks — tool Teks tidak akan menemukan teks apa pun sampai OCR dijalankan."
          : `${scannedPageCount} dari ${totalPages} halaman tampaknya hasil pindai tanpa lapisan teks.`}
      </p>
      {ocrState.running ? (
        <span className="shrink-0 font-medium text-[var(--warning)]">
          Menjalankan OCR... {Math.round((ocrState.progress || 0) * 100)}%
        </span>
      ) : (
        <button
          onClick={onRunOcr}
          className="shrink-0 rounded-md bg-[var(--warning)] px-3 py-1.5 font-medium text-[#3a2a06] transition-opacity hover:opacity-90"
        >
          Jalankan OCR dulu
        </button>
      )}
    </div>
  );
}

function AutosaveStatus() {
  const status = useEditorStore((s) => s.autosaveStatus);
  const at = useEditorStore((s) => s.autosaveAt);

  if (status === "idle") return null;

  const label =
    status === "pending"
      ? "Perubahan belum disimpan..."
      : status === "saving"
      ? "Menyimpan..."
      : status === "error"
      ? "Gagal menyimpan otomatis"
      : at
      ? `Tersimpan otomatis ${new Date(at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`
      : "Tersimpan otomatis";

  const Icon = status === "saving" || status === "pending" ? Loader2 : status === "error" ? AlertCircle : Check;

  return (
    <span
      className={clsx(
        "hidden items-center gap-1.5 text-[11.5px] sm:flex",
        status === "error" ? "text-[var(--danger)]" : "text-muted"
      )}
      title="Progres editing disimpan otomatis di perangkat ini (IndexedDB) untuk dipulihkan jika tab tertutup atau browser crash."
    >
      <Icon className={clsx("size-3.5", (status === "saving" || status === "pending") && "animate-spin")} />
      {label}
    </span>
  );
}

function EditorWorkspace({ file, pdfDoc, scannedPageCount, onFileReplaced, onInsertPdf }) {
  const pages = useEditorStore((s) => s.pages);
  const activePageId = useEditorStore((s) => s.activePageId);
  const setAutoZoom = useEditorStore((s) => s.setAutoZoom);
  const reset = useEditorStore((s) => s.reset);
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [initialsOpen, setInitialsOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [ocrState, setOcrState] = useState({ running: false, progress: 0 });
  const [findState, setFindState] = useState({ open: false, mode: "find" });
  const canvasAreaRef = useRef(null);
  const handle = useCanvasHandle();
  const toast = useToast();

  const activePage = pages.find((p) => p.id === activePageId);

  // Keep the page fitted to the visible width by default — without this a
  // page opens at a fixed 100% zoom, which is wider than most phone screens
  // and makes the editor look broken (huge blank page, everything shifted
  // off-screen) until the user manually zooms out. Re-fits on page switch,
  // device rotation, or the properties panel opening/closing (both resize
  // the visible canvas area), but backs off the moment the user picks their
  // own zoom level.
  useEffect(() => {
    const el = canvasAreaRef.current;
    if (!el || !activePage) return;
    const fit = () => {
      if (!useEditorStore.getState().zoomIsAuto) return;
      // Match the area's actual horizontal padding (p-4 → 32px, lg:p-10 →
      // 80px) instead of hardcoding one, so the fit is exact at every
      // breakpoint rather than leaving an arbitrary gap or clipping a hair.
      const styles = window.getComputedStyle(el);
      const paddingX = parseFloat(styles.paddingLeft || 0) + parseFloat(styles.paddingRight || 0);
      const available = el.clientWidth - paddingX;
      if (available <= 0) return;
      const fitZoom = available / activePage.widthPt;
      // Never zoom a page *in* past 100% automatically — only ever fit it
      // down to fewer available pixels than its natural size.
      setAutoZoom(Math.max(0.25, Math.min(1, fitZoom)));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [activePage?.id, activePage?.widthPt, setAutoZoom]);

  // Ctrl+F / Ctrl+H open the Find & Replace bar instead of the browser's own
  // find-in-page (which can't see canvas-rendered PDF content anyway).
  useEffect(() => {
    const onKeyDown = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === "f") {
        e.preventDefault();
        setFindState({ open: true, mode: "find" });
      } else if (key === "h") {
        e.preventDefault();
        setFindState({ open: true, mode: "replace" });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Don't let a stray tab close silently throw away edits Word users would
  // expect to be prompted about. Flushes first so a mid-edit textbox counts.
  useEffect(() => {
    const onBeforeUnload = (e) => {
      handle.current.flushPendingEdits?.();
      const store = useEditorStore.getState();
      const hasEdits = store.pages.some((p) => (store.historyByPage[p.id]?.past?.length || 0) > 0);
      if (!hasEdits) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRunOcr = async () => {
    setOcrState({ running: true, progress: 0 });
    try {
      const { blob } = await ocrToSearchablePdf(file, {}, ({ progress }) =>
        setOcrState({ running: true, progress })
      );
      const ocredFile = new File([blob], file.name, { type: "application/pdf" });
      await onFileReplaced(ocredFile);
      toast.success("OCR selesai", "Dokumen sekarang punya lapisan teks yang bisa diedit.");
    } catch (e) {
      console.error(e);
      toast.error("OCR gagal", e?.message);
    } finally {
      setOcrState({ running: false, progress: 0 });
    }
  };

  const handleExtractPages = async (pageIds) => {
    handle.current.flushPendingEdits?.();
    const selected = pages.filter((p) => pageIds.includes(p.id));
    if (selected.length === 0) return;
    try {
      const blob = await exportEditedPdf({
        originalFile: file,
        pdfDoc,
        pages: selected,
        canvasJSON: useEditorStore.getState().canvasJSON,
        onProgress: () => {},
      });
      downloadBlob(blob, file.name.replace(/\.pdf$/i, "") + "-halaman-dipilih.pdf");
      toast.success("Halaman berhasil diekstrak", `${selected.length} halaman disimpan ke file PDF baru.`);
    } catch (e) {
      console.error(e);
      toast.error("Gagal mengekstrak halaman", e?.message);
    }
  };

  const handleExport = async () => {
    handle.current.flushPendingEdits?.();
    setExporting(true);
    try {
      const blob = await exportEditedPdf({
        originalFile: file,
        pdfDoc,
        pages,
        canvasJSON: useEditorStore.getState().canvasJSON,
        onProgress: () => {},
      });
      downloadBlob(blob, file.name.replace(/\.pdf$/i, "") + "-diedit.pdf");
      addHistoryEntry({ toolId: "pdf-editor", toolName: TOOLS["pdf-editor"].name, fileName: file.name });
      toast.success("PDF berhasil diekspor", "Perubahan Anda telah disimpan ke file baru.");
    } catch (e) {
      console.error(e);
      toast.error("Gagal mengekspor PDF", e?.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="pdf-editor-shell flex h-full flex-col bg-surface-2">
      {/* iLovePDF-style top bar: filename/page count on the left, a solid
          red "Save" pill on the right — the one action that always stays
          reachable no matter how the toolbar below scrolls on small screens. */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-hair bg-surface px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <button
            onClick={reset}
            title="Buka file lain"
            aria-label="Buka file lain"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink"
          >
            <svg viewBox="0 0 24 24" fill="none" className="size-[18px]" aria-hidden="true">
              <path d="M19 12H5M5 12l6-6M5 12l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-ink">{file.name}</p>
            <p className="text-[11px] text-muted">{pages.length} halaman &middot; Editor PDF</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <AutosaveStatus />
          <Button size="sm" icon={Download} loading={exporting} onClick={handleExport} className="rounded-full px-5">
            <span className="hidden sm:inline">Simpan sebagai PDF</span>
            <span className="sm:hidden">Simpan</span>
          </Button>
        </div>
      </div>

      <EditorToolbar
        onOpenSignature={() => setSignatureOpen(true)}
        onOpenInitials={() => setInitialsOpen(true)}
        onOpenFind={() => setFindState({ open: true, mode: "find" })}
      />

      <ScannedPdfBanner
        scannedPageCount={scannedPageCount}
        totalPages={pages.length}
        onRunOcr={handleRunOcr}
        ocrState={ocrState}
      />

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <ThumbnailSidebar pdfDoc={pdfDoc} onExtractPages={handleExtractPages} onInsertPdf={onInsertPdf} />
        <div ref={canvasAreaRef} className="relative flex-1 overflow-auto p-4 pb-16 lg:p-10 lg:pb-10">
          <div className="flex min-h-full items-start justify-center">
            <PdfCanvas pdfDoc={pdfDoc} />
          </div>
          <FindReplaceBar
            open={findState.open}
            mode={findState.mode}
            pdfDoc={pdfDoc}
            onClose={() => setFindState((s) => ({ ...s, open: false }))}
          />
        </div>
        <PropertiesPanel />
      </div>

      <SignaturePad
        open={signatureOpen}
        onClose={() => setSignatureOpen(false)}
        onConfirm={(dataUrl) => handle.current.addImageFromDataUrl(dataUrl)}
      />
      <SignaturePad
        mode="initials"
        open={initialsOpen}
        onClose={() => setInitialsOpen(false)}
        onConfirm={(dataUrl) => handle.current.addImageFromDataUrl(dataUrl)}
      />
    </div>
  );
}

export default function PdfEditorPage() {
  const tool = TOOLS["pdf-editor"];
  const file = useEditorStore((s) => s.originalFile);
  const init = useEditorStore((s) => s.init);
  const restoreSnapshot = useEditorStore((s) => s.restoreSnapshot);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [scannedPageCount, setScannedPageCount] = useState(0);
  const [recoverable, setRecoverable] = useState(undefined); // undefined = still checking, null = none, object = found
  const [recovering, setRecovering] = useState(false);

  // Check once, on first load of the empty/Dropzone screen, whether an
  // autosaved session from a previous visit (refresh, closed tab, crash) is
  // sitting in IndexedDB.
  useEffect(() => {
    let cancelled = false;
    loadAutosaveSnapshot()
      .then((snap) => {
        if (!cancelled) setRecoverable(snap);
      })
      .catch(() => {
        if (!cancelled) setRecoverable(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const countScannedPages = async (doc) => {
    let scanned = 0;
    for (let i = 1; i <= doc.numPages; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const page = await doc.getPage(i);
      // eslint-disable-next-line no-await-in-loop
      const textContent = await page.getTextContent();
      if (!textContent.items.some((it) => it.str && it.str.trim())) scanned += 1;
    }
    return scanned;
  };

  const handleFile = async (files) => {
    const f = files[0];
    setLoading(true);
    try {
      clearPageTextCache();
      const doc = await loadPdfDocument(f);
      const pages = [];
      let scanned = 0;
      for (let i = 1; i <= doc.numPages; i += 1) {
        const page = await doc.getPage(i);
        const viewport = page.getViewport({ scale: 1 });
        const textContent = await page.getTextContent();
        if (!textContent.items.some((it) => it.str && it.str.trim())) scanned += 1;
        pages.push({
          id: uid("page"),
          kind: "source",
          sourceIndex: i - 1,
          rotation: 0,
          widthPt: viewport.width,
          heightPt: viewport.height,
        });
      }
      setScannedPageCount(scanned);
      setPdfDoc(doc);
      init({ file: f, pages });
      setRecoverable(null);
    } finally {
      setLoading(false);
    }
  };

  const handleRecover = async () => {
    if (!recoverable) return;
    setRecovering(true);
    try {
      const restoredFile =
        recoverable.originalFile instanceof File
          ? recoverable.originalFile
          : new File([recoverable.originalFile], recoverable.fileName || "dokumen.pdf", {
              type: "application/pdf",
            });
      clearPageTextCache();
      const doc = await loadPdfDocument(restoredFile);
      const scanned = await countScannedPages(doc);
      setScannedPageCount(scanned);
      setPdfDoc(doc);
      restoreSnapshot({
        file: restoredFile,
        fileName: recoverable.fileName,
        pages: recoverable.pages,
        canvasJSON: recoverable.canvasJSON,
      });
      setRecoverable(null);
    } catch (err) {
      console.error("Gagal memulihkan dokumen:", err);
      setRecoverable(null);
      clearAutosaveSnapshot();
    } finally {
      setRecovering(false);
    }
  };

  const handleDiscardRecovery = () => {
    clearAutosaveSnapshot();
    setRecoverable(null);
  };

  useEffect(() => {
    if (!file) {
      setPdfDoc(null);
      setScannedPageCount(0);
    }
  }, [file]);

  // Merge another PDF's pages onto the end of the underlying document (so
  // every existing page's sourceIndex stays valid, see pdfPageOps.js), then
  // splice their new page metas into the visual page list right after
  // `afterPageId`. Kept at this level because it's the one place that owns
  // both the editor store *and* the pdfjs `pdfDoc` used for thumbnails/text
  // extraction — both need to be swapped together, atomically.
  const handleInsertPdf = async (insertFile, afterPageId) => {
    const { mergedFile, startIndex, count } = await appendPdfPages(file, insertFile);
    const mergedDoc = await loadPdfDocument(mergedFile);
    const newPages = [];
    for (let i = 0; i < count; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const page = await mergedDoc.getPage(startIndex + i + 1);
      const viewport = page.getViewport({ scale: 1 });
      newPages.push({
        id: uid("page"),
        kind: "source",
        sourceIndex: startIndex + i,
        rotation: 0,
        widthPt: viewport.width,
        heightPt: viewport.height,
      });
    }
    useEditorStore.getState().setOriginalFile(mergedFile);
    useEditorStore.getState().insertSourcePages(afterPageId, newPages);
    setPdfDoc(mergedDoc);
  };

  if (!file) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-8 lg:px-8">
        <ToolPageHeader tool={tool} />
        {loading || recovering ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border-hair py-16">
            <Spinner />
            <p className="text-[13px] text-muted">{recovering ? "Memulihkan dokumen..." : "Membuka dokumen..."}</p>
          </div>
        ) : (
          <>
            {recoverable && (
              <div className="mb-4 flex flex-col gap-3 rounded-xl border border-[var(--accent)]/30 bg-[color-mix(in_srgb,var(--accent)_6%,transparent)] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <RotateCcw className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
                  <div>
                    <p className="text-[13px] font-semibold text-ink">Ada progres editing yang belum disimpan</p>
                    <p className="text-[12px] text-muted">
                      "{recoverable.fileName}"
                      {recoverable.savedAt
                        ? ` — tersimpan otomatis ${new Date(recoverable.savedAt).toLocaleString("id-ID", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}`
                        : ""}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="secondary" size="sm" icon={TrashIcon} onClick={handleDiscardRecovery}>
                    Buang
                  </Button>
                  <Button size="sm" icon={RotateCcw} onClick={handleRecover}>
                    Pulihkan
                  </Button>
                </div>
              </div>
            )}
            <Dropzone accept={tool.accept} onFiles={handleFile} hint="Editor berjalan sepenuhnya di browser Anda" />
          </>
        )}
      </div>
    );
  }

  if (!pdfDoc) return null;

  return (
    <CanvasProvider>
      <EditorWorkspace
        file={file}
        pdfDoc={pdfDoc}
        scannedPageCount={scannedPageCount}
        onFileReplaced={(f) => handleFile([f])}
        onInsertPdf={handleInsertPdf}
      />
    </CanvasProvider>
  );
}
