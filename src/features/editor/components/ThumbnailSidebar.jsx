import { useEffect, useRef, useState } from "react";
import {
  Plus,
  Trash2,
  RotateCw,
  ChevronUp,
  ChevronDown,
  GripVertical,
  Copy,
  Scissors,
  FilePlus,
  CheckSquare,
  Square,
  X,
  Loader2,
} from "lucide-react";
import clsx from "clsx";
import { useEditorStore } from "../useEditorStore";
import { useCanvasHandle } from "../CanvasContext";
import { renderPageToCanvas } from "../../../lib/pdfjs";
import { useToast } from "../../../context/ToastContext";

export default function ThumbnailSidebar({ pdfDoc, onExtractPages, onInsertPdf }) {
  const pages = useEditorStore((s) => s.pages);
  const activePageId = useEditorStore((s) => s.activePageId);
  const setActivePage = useEditorStore((s) => s.setActivePage);
  const reorderPages = useEditorStore((s) => s.reorderPages);
  const deletePage = useEditorStore((s) => s.deletePage);
  const addBlankPage = useEditorStore((s) => s.addBlankPage);
  const rotatePageMeta = useEditorStore((s) => s.rotatePageMeta);
  const duplicatePage = useEditorStore((s) => s.duplicatePage);
  const removePages = useEditorStore((s) => s.removePages);
  const handle = useCanvasHandle();
  const toast = useToast();
  const [thumbs, setThumbs] = useState({});
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [extracting, setExtracting] = useState(false);
  const [inserting, setInserting] = useState(false);
  const insertInputRef = useRef(null);

  useEffect(() => {
    if (!pdfDoc) return;
    pages.forEach((p) => {
      if (p.kind !== "source" || thumbs[p.id]) return;
      renderPageToCanvas(pdfDoc, p.sourceIndex + 1, 0.22).then(({ canvas }) => {
        setThumbs((prev) => ({ ...prev, [p.id]: canvas.toDataURL("image/png") }));
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages, pdfDoc]);

  // Dropping a duplicated/removed/inserted page can leave stale ids in the
  // selection set (they no longer exist in `pages`) — prune on every change
  // instead of letting the count in the action bar drift out of sync.
  useEffect(() => {
    setSelectedIds((prev) => {
      const idSet = new Set(pages.map((p) => p.id));
      let changed = false;
      const next = new Set();
      prev.forEach((id) => {
        if (idSet.has(id)) next.add(id);
        else changed = true;
      });
      return changed ? next : prev;
    });
  }, [pages]);

  const move = (from, to) => {
    handle.current.flushPendingEdits?.();
    const next = [...pages];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    reorderPages(next);
  };

  const toggleSelected = (pageId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(pageId)) next.delete(pageId);
      else next.add(pageId);
      return next;
    });
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const handleExtractSelected = async () => {
    if (selectedIds.size === 0 || !onExtractPages) return;
    // Keep visual (document) order regardless of click order.
    const orderedIds = pages.filter((p) => selectedIds.has(p.id)).map((p) => p.id);
    setExtracting(true);
    try {
      await onExtractPages(orderedIds);
    } finally {
      setExtracting(false);
    }
  };

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    if (pages.length - selectedIds.size < 1) {
      toast.warning("Tidak bisa menghapus semua halaman", "Sisakan setidaknya satu halaman di dokumen.");
      return;
    }
    handle.current.flushPendingEdits?.();
    removePages([...selectedIds]);
    exitSelectMode();
  };

  const handleInsertFileChosen = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !onInsertPdf) return;
    handle.current.flushPendingEdits?.();
    setInserting(true);
    try {
      await onInsertPdf(file, activePageId);
      toast.success("PDF disisipkan", `Halaman dari "${file.name}" ditambahkan setelah halaman aktif.`);
    } catch (err) {
      console.error(err);
      toast.error("Gagal menyisipkan PDF", err?.message || "File mungkin rusak atau terenkripsi.");
    } finally {
      setInserting(false);
    }
  };

  return (
    <div className="flex h-28 w-full shrink-0 flex-col border-b border-hair bg-surface lg:h-full lg:w-48 lg:border-b-0 lg:border-r">
      <div className="flex shrink-0 items-center justify-between gap-1.5 border-b border-hair px-2.5 py-2">
        {selectMode ? (
          <>
            <span className="text-[11.5px] font-medium text-muted">{selectedIds.size} dipilih</span>
            <div className="flex items-center gap-1">
              <IconBtn
                icon={extracting ? Loader2 : Scissors}
                label="Ekstrak halaman terpilih ke PDF baru"
                onClick={handleExtractSelected}
                disabled={selectedIds.size === 0 || extracting}
                spin={extracting}
              />
              <IconBtn
                icon={Trash2}
                label="Hapus halaman terpilih"
                danger
                disabled={selectedIds.size === 0}
                onClick={handleDeleteSelected}
              />
              <IconBtn icon={X} label="Batalkan pilihan" onClick={exitSelectMode} />
            </div>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setSelectMode(true)}
              className="flex items-center gap-1 rounded-full px-2 py-1 text-[11.5px] font-medium text-muted hover:bg-surface-2 hover:text-ink"
            >
              <CheckSquare className="size-3.5" />
              Pilih
            </button>
            <IconBtn
              icon={inserting ? Loader2 : FilePlus}
              label="Sisipkan PDF setelah halaman aktif"
              onClick={() => insertInputRef.current?.click()}
              disabled={inserting}
              spin={inserting}
            />
            <input
              ref={insertInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handleInsertFileChosen}
            />
          </>
        )}
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden p-3 lg:overflow-x-visible lg:overflow-y-auto">
        <div className="flex gap-3 lg:flex-col">
          {pages.map((page, idx) => {
            const isSelected = selectedIds.has(page.id);
            return (
              <div
                key={page.id}
                draggable={!selectMode}
                onDragStart={(e) => e.dataTransfer.setData("text/plain", String(idx))}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => move(Number(e.dataTransfer.getData("text/plain")), idx)}
                onClick={() => {
                  if (selectMode) {
                    toggleSelected(page.id);
                    return;
                  }
                  if (page.id !== activePageId) handle.current.flushPendingEdits?.();
                  setActivePage(page.id);
                }}
                className={clsx(
                  "group relative w-16 shrink-0 cursor-pointer rounded-lg border-2 p-1.5 transition-all lg:w-full",
                  isSelected
                    ? "border-accent bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]"
                    : page.id === activePageId
                    ? "border-accent bg-surface shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_16%,transparent)]"
                    : "border-transparent hover:bg-surface-2"
                )}
              >
                <div
                  className="relative mx-auto flex items-center justify-center overflow-hidden rounded-md bg-white shadow-sm"
                  style={{
                    aspectRatio: `${page.widthPt} / ${page.heightPt}`,
                    transform: `rotate(${page.rotation}deg)`,
                  }}
                >
                  {page.kind === "source" ? (
                    thumbs[page.id] ? (
                      <img src={thumbs[page.id]} alt="" className="h-full w-full object-contain" />
                    ) : (
                      <div className="h-full w-full animate-pulse bg-surface-2" />
                    )
                  ) : (
                    <div className="h-full w-full border border-dashed border-hair bg-white" />
                  )}
                  {selectMode && (
                    <div
                      className={clsx(
                        "absolute right-1 top-1 flex size-4 items-center justify-center rounded-sm",
                        isSelected ? "bg-accent text-accent-ink" : "bg-white/90 text-muted shadow-sm"
                      )}
                    >
                      {isSelected ? <CheckSquare className="size-3" /> : <Square className="size-3" />}
                    </div>
                  )}
                </div>

                <div className="mt-1.5 flex items-center justify-between px-0.5">
                  <span
                    className={clsx(
                      "flex size-4 shrink-0 items-center justify-center rounded-full font-mono text-[9.5px] font-semibold",
                      page.id === activePageId ? "bg-accent text-accent-ink" : "bg-surface-2 text-muted"
                    )}
                  >
                    {idx + 1}
                  </span>
                  {!selectMode && (
                    <>
                      <GripVertical className="hidden size-3 opacity-30 lg:block" aria-hidden="true" />
                      <div className="flex items-center gap-0.5 opacity-100 lg:opacity-0 lg:transition-opacity lg:group-hover:opacity-100 lg:group-focus-within:opacity-100">
                        {idx > 0 && <IconBtn icon={ChevronUp} label="Pindah ke atas" onClick={(e) => { e.stopPropagation(); move(idx, idx - 1); }} />}
                        {idx < pages.length - 1 && <IconBtn icon={ChevronDown} label="Pindah ke bawah" onClick={(e) => { e.stopPropagation(); move(idx, idx + 1); }} />}
                        <IconBtn
                          icon={Copy}
                          label="Duplikat halaman"
                          onClick={(e) => {
                            e.stopPropagation();
                            handle.current.flushPendingEdits?.();
                            duplicatePage(page.id);
                          }}
                        />
                        <IconBtn
                          icon={RotateCw}
                          label="Putar halaman"
                          onClick={(e) => {
                            e.stopPropagation();
                            rotatePageMeta(page.id, 90);
                          }}
                        />
                        {pages.length > 1 && (
                          <IconBtn
                            icon={Trash2}
                            label="Hapus halaman"
                            danger
                            onClick={(e) => {
                              e.stopPropagation();
                              handle.current.flushPendingEdits?.();
                              deletePage(page.id);
                            }}
                          />
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {!selectMode && (
        <button
          type="button"
          onClick={() => addBlankPage(activePageId)}
          className="m-2.5 mt-0 flex shrink-0 items-center justify-center gap-1.5 rounded-full border border-dashed border-[var(--accent)]/50 py-2 text-[12.5px] font-medium text-accent hover:bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] lg:mt-2.5"
        >
          <Plus className="size-3.5" />
          Tambah halaman
        </button>
      )}
    </div>
  );
}

function IconBtn({ icon: Icon, label, onClick, danger, disabled, spin }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        "flex size-5 items-center justify-center rounded-full text-muted hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40",
        danger ? "hover:text-[var(--danger)]" : "hover:text-ink"
      )}
    >
      <Icon className={clsx("size-3", spin && "animate-spin")} />
    </button>
  );
}
