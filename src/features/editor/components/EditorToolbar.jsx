import { useEffect, useRef } from "react";
import {
  MousePointer2,
  Type,
  Edit3,
  Image as ImageIcon,
  PenLine,
  Highlighter,
  Pencil,
  Square,
  Circle as CircleIcon,
  Minus,
  Trash2,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Search,
  ChevronLeft,
  ChevronRight,
  Maximize2,
} from "lucide-react";
import clsx from "clsx";
import { useEditorStore } from "../useEditorStore";
import { useCanvasHandle } from "../CanvasContext";

// Grouped logically: pointer/edit modes, drawing/annotation shapes, then
// insert actions live in their own cluster below. Each tool's `key` is the
// single-letter shortcut shown in its tooltip and wired up in the keydown
// handler at the bottom of this file.
const SELECT_TOOLS = [
  { id: "select", icon: MousePointer2, label: "Pilih & Pindah", key: "V" },
  { id: "editText", icon: Edit3, label: "Edit Teks Asli (klik teks di PDF)", key: "E" },
];
const DRAW_TOOLS = [
  { id: "text", icon: Type, label: "Tambah Teks", key: "T" },
  { id: "draw", icon: Pencil, label: "Gambar Bebas", key: "P" },
  { id: "highlight", icon: Highlighter, label: "Sorot (Highlight)", key: "H" },
  { id: "rect", icon: Square, label: "Persegi", key: "R" },
  { id: "circle", icon: CircleIcon, label: "Lingkaran", key: "C" },
  { id: "line", icon: Minus, label: "Garis", key: "L" },
];

export default function EditorToolbar({ onOpenSignature, onOpenFind }) {
  const tool = useEditorStore((s) => s.tool);
  const setTool = useEditorStore((s) => s.setTool);
  const zoom = useEditorStore((s) => s.zoom);
  const setZoom = useEditorStore((s) => s.setZoom);
  const activePageId = useEditorStore((s) => s.activePageId);
  const pages = useEditorStore((s) => s.pages);
  const setActivePageByOffset = useEditorStore((s) => s.setActivePageByOffset);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const historyByPage = useEditorStore((s) => s.historyByPage);
  const handle = useCanvasHandle();
  const imageInputRef = useRef(null);

  const hist = historyByPage[activePageId] || { past: [], future: [] };

  // Only used by the toolbar's Undo/Redo *buttons* (already disabled via
  // hist.past/future.length checks above, so `json` here is never the
  // "nothing left to undo" `null` — it's either a real snapshot or the
  // page's genuine blank starting state).
  const applyHistoryJson = (json) => {
    const canvas = handle.current.canvas;
    if (!canvas) return;
    if (!json) {
      canvas.clear();
      canvas.requestRenderAll();
      return;
    }
    canvas.loadFromJSON(JSON.parse(json)).then(() => canvas.requestRenderAll());
  };

  // Keyboard shortcuts for the tool switcher, page navigation and zoom —
  // skipped whenever focus is inside a text field so typing "t" in a text
  // box doesn't hijack the tool. Undo/redo/delete/copy/paste are handled
  // exclusively by PdfCanvas's own keydown listener (it has direct access
  // to the live fabric canvas and already guards against the "nothing to
  // undo" case) — duplicating them here caused every Ctrl+Z/Ctrl+Y/Delete
  // press to fire twice and silently eat an extra history step (or clear
  // the whole page when only one undo was actually available).
  useEffect(() => {
    const onKeyDown = (e) => {
      const target = e.target;
      const isTyping =
        target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (isTyping) return;
      const mod = e.ctrlKey || e.metaKey;

      if (mod && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        setZoom(zoom + 0.1);
        return;
      }
      if (mod && e.key === "-") {
        e.preventDefault();
        setZoom(zoom - 0.1);
        return;
      }
      if (mod) return;

      if (e.key === "PageUp" || e.key === "ArrowLeft") {
        if (e.altKey || e.key === "PageUp") {
          e.preventDefault();
          setActivePageByOffset(-1);
          return;
        }
      }
      if (e.key === "PageDown" || e.key === "ArrowRight") {
        if (e.altKey || e.key === "PageDown") {
          e.preventDefault();
          setActivePageByOffset(1);
          return;
        }
      }

      const match = [...SELECT_TOOLS, ...DRAW_TOOLS].find((t) => t.key.toLowerCase() === e.key.toLowerCase());
      if (match) setTool(match.id);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePageId, zoom, pages.length]);

  return (
    <div className="flex justify-center border-b border-hair bg-surface-2 px-2 py-2.5">
    <div className="scrollbar-hidden flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-hair bg-surface px-2 py-1.5 shadow-sm sm:gap-1.5 sm:px-2.5">
      <ToolGroup>
        {SELECT_TOOLS.map((t) => (
          <ToolButton
            key={t.id}
            active={tool === t.id}
            label={t.label}
            shortcut={t.key}
            onClick={() => setTool(t.id)}
            icon={t.icon}
          />
        ))}
      </ToolGroup>

      <Divider />

      <ToolGroup>
        {DRAW_TOOLS.map((t) => (
          <ToolButton
            key={t.id}
            active={tool === t.id}
            label={t.label}
            shortcut={t.key}
            onClick={() => setTool(t.id)}
            icon={t.icon}
          />
        ))}
      </ToolGroup>

      <Divider />

      <ToolGroup>
        <ToolButton label="Tambah Gambar" icon={ImageIcon} onClick={() => imageInputRef.current?.click()} />
        <input
          ref={imageInputRef}
          type="file"
          accept="image/png,image/jpeg"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => handle.current.addImageFromDataUrl(reader.result);
            reader.readAsDataURL(file);
          }}
        />
        <ToolButton label="Tanda Tangan" icon={PenLine} onClick={onOpenSignature} />
        <ToolButton label="Cari & Ganti Teks" shortcut="Ctrl+F" onClick={() => onOpenFind?.()} icon={Search} />
      </ToolGroup>

      <Divider />

      <ToolGroup>
        <ToolButton label="Hapus elemen terpilih" shortcut="Del" icon={Trash2} onClick={() => handle.current.deleteActive?.()} />
      </ToolGroup>

      <Divider />

      <ToolGroup>
        <ToolButton
          label="Urungkan"
          shortcut="Ctrl+Z"
          icon={Undo2}
          disabled={hist.past.length === 0}
          onClick={() => applyHistoryJson(undo(activePageId))}
        />
        <ToolButton
          label="Ulangi"
          shortcut="Ctrl+Y"
          icon={Redo2}
          disabled={hist.future.length === 0}
          onClick={() => applyHistoryJson(redo(activePageId))}
        />
      </ToolGroup>

      <Divider />

      <ToolGroup>
        <ToolButton
          label="Halaman sebelumnya"
          shortcut="Alt+←"
          icon={ChevronLeft}
          disabled={pages.findIndex((p) => p.id === activePageId) <= 0}
          onClick={() => setActivePageByOffset(-1)}
        />
        <span className="min-w-14 px-1 text-center text-[11px] tabular-nums text-muted" aria-live="polite">
          {Math.max(1, pages.findIndex((p) => p.id === activePageId) + 1)} / {pages.length}
        </span>
        <ToolButton
          label="Halaman berikutnya"
          shortcut="Alt+→"
          icon={ChevronRight}
          disabled={pages.findIndex((p) => p.id === activePageId) === pages.length - 1}
          onClick={() => setActivePageByOffset(1)}
        />
      </ToolGroup>

      <Divider />

      <ToolGroup>
        <ToolButton label="Perkecil" shortcut="Ctrl+-" icon={ZoomOut} onClick={() => setZoom(zoom - 0.1)} />
        <span className="w-10 shrink-0 text-center font-mono text-[12px] tabular-nums text-muted">
          {Math.round(zoom * 100)}%
        </span>
        <ToolButton label="Perbesar" shortcut="Ctrl++" icon={ZoomIn} onClick={() => setZoom(zoom + 0.1)} />
        <ToolButton label="Reset zoom ke 100%" icon={Maximize2} onClick={() => setZoom(1)} />
      </ToolGroup>
    </div>
    </div>
  );
}

function ToolGroup({ children }) {
  return <div className="flex shrink-0 items-center gap-0.5 rounded-full bg-surface-2/70 p-0.5">{children}</div>;
}

function Divider() {
  return <div className="mx-0.5 h-6 w-px shrink-0 bg-[var(--border)]" />;
}

function ToolButton({ icon: Icon, label, shortcut, active, disabled, onClick }) {
  const tooltip = shortcut ? `${label} (${shortcut})` : label;
  return (
    <button
      type="button"
      title={tooltip}
      aria-label={tooltip}
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        "tooltip flex size-8 shrink-0 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-35",
        active ? "bg-accent text-accent-ink shadow-sm" : "text-muted tool-btn-hover hover:text-ink"
      )}
      data-tooltip={tooltip}
    >
      <Icon className="size-[17px]" />
    </button>
  );
}