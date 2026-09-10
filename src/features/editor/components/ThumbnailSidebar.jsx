import { useEffect, useState } from "react";
import { Plus, Trash2, RotateCw, ChevronUp, ChevronDown, GripVertical } from "lucide-react";
import clsx from "clsx";
import { useEditorStore } from "../useEditorStore";
import { useCanvasHandle } from "../CanvasContext";
import { renderPageToCanvas } from "../../../lib/pdfjs";

export default function ThumbnailSidebar({ pdfDoc }) {
  const pages = useEditorStore((s) => s.pages);
  const activePageId = useEditorStore((s) => s.activePageId);
  const setActivePage = useEditorStore((s) => s.setActivePage);
  const reorderPages = useEditorStore((s) => s.reorderPages);
  const deletePage = useEditorStore((s) => s.deletePage);
  const addBlankPage = useEditorStore((s) => s.addBlankPage);
  const rotatePageMeta = useEditorStore((s) => s.rotatePageMeta);
  const handle = useCanvasHandle();
  const [thumbs, setThumbs] = useState({});

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

  const move = (from, to) => {
    handle.current.flushPendingEdits?.();
    const next = [...pages];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    reorderPages(next);
  };

  return (
    <div className="flex h-28 w-full shrink-0 flex-col border-b border-hair bg-surface lg:h-full lg:w-48 lg:border-b-0 lg:border-r">
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-3 lg:overflow-x-visible lg:overflow-y-auto">
        <div className="flex gap-3 lg:flex-col">
          {pages.map((page, idx) => (
            <div
              key={page.id}
              draggable
              onDragStart={(e) => e.dataTransfer.setData("text/plain", String(idx))}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => move(Number(e.dataTransfer.getData("text/plain")), idx)}
              onClick={() => {
                if (page.id !== activePageId) handle.current.flushPendingEdits?.();
                setActivePage(page.id);
              }}
              className={clsx(
                "group relative w-16 shrink-0 cursor-pointer rounded-lg border-2 p-1.5 transition-all lg:w-full",
                page.id === activePageId
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
                <GripVertical className="hidden size-3 opacity-30 lg:block" aria-hidden="true" />
                <div className="flex items-center gap-0.5 opacity-100 lg:opacity-0 lg:transition-opacity lg:group-hover:opacity-100 lg:group-focus-within:opacity-100">
                  {idx > 0 && <IconBtn icon={ChevronUp} label="Pindah ke atas" onClick={(e) => { e.stopPropagation(); move(idx, idx - 1); }} />}
                  {idx < pages.length - 1 && <IconBtn icon={ChevronDown} label="Pindah ke bawah" onClick={(e) => { e.stopPropagation(); move(idx, idx + 1); }} />}
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
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => addBlankPage(activePageId)}
        className="m-2.5 mt-0 flex shrink-0 items-center justify-center gap-1.5 rounded-full border border-dashed border-[var(--accent)]/50 py-2 text-[12.5px] font-medium text-accent hover:bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] lg:mt-2.5"
      >
        <Plus className="size-3.5" />
        Tambah halaman
      </button>
    </div>
  );
}

function IconBtn({ icon: Icon, label, onClick, danger }) {
  return (
    <button
      title={label}
      aria-label={label}
      onClick={onClick}
      className={clsx(
        "flex size-5 items-center justify-center rounded-full text-muted hover:bg-surface",
        danger ? "hover:text-[var(--danger)]" : "hover:text-ink"
      )}
    >
      <Icon className="size-3" />
    </button>
  );
}
