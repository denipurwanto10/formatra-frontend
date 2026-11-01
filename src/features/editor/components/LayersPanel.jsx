import { useState } from "react";
import { Eye, EyeOff, Lock, Unlock, ChevronUp, ChevronDown } from "lucide-react";
import clsx from "clsx";
import { useEditorStore } from "../useEditorStore";
import { useCanvasHandle } from "../CanvasContext";

function defaultLabelFor(obj, position) {
  if (obj.isStickyNote) return `Catatan ${position}`;
  if (obj.isFormField) {
    if (obj.fieldType === "checkbox") return `Checkbox ${position}`;
    if (obj.fieldType === "date") return `Kolom Tanggal ${position}`;
    return `Kolom Teks ${position}`;
  }
  switch (obj.type) {
    case "Textbox":
    case "IText":
    case "Text":
      return `Teks ${position}`;
    case "Rect":
      return `Persegi ${position}`;
    case "Circle":
      return `Lingkaran ${position}`;
    case "Line":
      return `Garis ${position}`;
    case "Path":
      return `Coretan ${position}`;
    case "Polygon":
      return `Bentuk ${position}`;
    case "Group":
      return `Grup ${position}`;
    case "Image":
      return `Gambar ${position}`;
    default:
      return `Objek ${position}`;
  }
}

export default function LayersPanel() {
  const handle = useCanvasHandle();
  // Re-render whenever the canvas is persisted (add/remove/reorder/rename/
  // lock/hide all funnel through commit()) or the selection changes —
  // the object list itself is read live from the fabric canvas each render.
  // eslint-disable-next-line no-unused-vars
  const selectionTick = useEditorStore((s) => s.selectionTick);
  const activePageId = useEditorStore((s) => s.activePageId);
  // eslint-disable-next-line no-unused-vars
  const pageJson = useEditorStore((s) => s.canvasJSON[activePageId]);
  const [renamingObj, setRenamingObj] = useState(null);
  const [renameValue, setRenameValue] = useState("");

  const objects = handle.current.getLayerObjects?.() ?? [];
  const active = handle.current.getActive?.();

  if (objects.length === 0) {
    return (
      <p className="text-[12px] leading-relaxed text-muted">
        Belum ada objek di halaman ini. Tambahkan teks, bentuk, tanda tangan, atau gambar lewat toolbar untuk
        melihatnya di sini.
      </p>
    );
  }

  const commitRename = () => {
    if (renamingObj) handle.current.renameObject(renamingObj, renameValue.trim());
    setRenamingObj(null);
  };

  // Topmost-drawn-first reading order (fabric's own array is back-to-front).
  const rows = objects.map((obj, zIndex) => ({ obj, zIndex })).reverse();

  return (
    <div className="flex flex-col gap-0.5">
      {rows.map(({ obj, zIndex }) => {
        const isActive = obj === active;
        const hidden = obj.visible === false;
        const locked = !!obj.locked;
        const label = obj.name?.trim() || defaultLabelFor(obj, zIndex + 1);
        const isRenaming = renamingObj === obj;

        return (
          <div
            key={zIndex}
            className={clsx(
              "group flex items-center gap-1 rounded-lg px-1.5 py-1.5",
              isActive ? "bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]" : "hover:bg-surface-2"
            )}
          >
            <button
              type="button"
              title={hidden ? "Tampilkan" : "Sembunyikan"}
              onClick={() => handle.current.toggleObjectVisible(obj)}
              className="flex size-6 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-ink"
            >
              {hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            </button>
            <button
              type="button"
              title={locked ? "Buka kunci" : "Kunci"}
              onClick={() => handle.current.toggleObjectLocked(obj)}
              className={clsx(
                "flex size-6 shrink-0 items-center justify-center rounded-full hover:bg-surface hover:text-ink",
                locked ? "text-accent" : "text-muted opacity-0 group-hover:opacity-100"
              )}
            >
              {locked ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}
            </button>

            {isRenaming ? (
              <input
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename();
                  if (e.key === "Escape") setRenamingObj(null);
                }}
                className="min-w-0 flex-1 rounded border border-accent bg-surface px-1.5 py-0.5 text-[12px] outline-none"
              />
            ) : (
              <button
                type="button"
                disabled={locked || hidden}
                onClick={() => handle.current.selectObject(obj)}
                onDoubleClick={() => {
                  setRenamingObj(obj);
                  setRenameValue(label);
                }}
                title="Klik untuk memilih, klik dua kali untuk mengganti nama"
                className={clsx(
                  "min-w-0 flex-1 truncate text-left text-[12px] disabled:cursor-not-allowed",
                  hidden ? "text-muted line-through" : "text-ink"
                )}
              >
                {label}
              </button>
            )}

            <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100">
              <button
                type="button"
                title="Maju satu lapis"
                onClick={() => handle.current.reorderLayerObject(obj, "forward")}
                className="flex size-6 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-ink"
              >
                <ChevronUp className="size-3.5" />
              </button>
              <button
                type="button"
                title="Mundur satu lapis"
                onClick={() => handle.current.reorderLayerObject(obj, "backward")}
                className="flex size-6 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-ink"
              >
                <ChevronDown className="size-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
