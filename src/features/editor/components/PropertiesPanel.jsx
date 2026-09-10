import { useState } from "react";
import { useEditorStore } from "../useEditorStore";
import { useCanvasHandle } from "../CanvasContext";
import {
  Trash2,
  ChevronUp,
  ChevronDown,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Highlighter,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  BringToFront,
  SendToBack,
  Group as GroupIcon,
  Ungroup as UngroupIcon,
  Crop,
  Copy,
  Check,
  X,
  AlignHorizontalJustifyStart,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
} from "lucide-react";
import Button from "../../../components/ui/Button";

const FONT_FAMILIES = [
  { label: "Helvetica / Arial", value: "Helvetica, Arial, sans-serif" },
  { label: "Times New Roman", value: '"Times New Roman", Times, serif' },
  { label: "Courier New", value: '"Courier New", Courier, monospace' },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Verdana", value: "Verdana, sans-serif" },
  { label: "Inter", value: "Inter, sans-serif" },
];

// Word's own font-size dropdown presets (Home ribbon), plus a free-typed
// number input right next to it — same combo Word uses.
const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 44, 48, 54, 60, 66, 72, 80, 88, 96];
// Word's "Line and Paragraph Spacing" presets (1.0/1.15/1.5/2.0/...).
const LINE_SPACINGS = [
  { label: "1.0", value: 1.0 },
  { label: "1.15", value: 1.15 },
  { label: "1.5", value: 1.5 },
  { label: "2.0", value: 2.0 },
  { label: "2.5", value: 2.5 },
];

export default function PropertiesPanel() {
  const tool = useEditorStore((s) => s.tool);
  const toolOptions = useEditorStore((s) => s.toolOptions);
  const setToolOptions = useEditorStore((s) => s.setToolOptions);
  // eslint-disable-next-line no-unused-vars
  const selectionTick = useEditorStore((s) => s.selectionTick);
  const handle = useCanvasHandle();
  const [mobileExpanded, setMobileExpanded] = useState(false);

  const active = handle.current.getActive?.();
  const cropping = handle.current.isCropping?.();
  const title = cropping ? "Potong Gambar (Crop)" : active ? "Properti Elemen" : "Pengaturan Alat";
  const content = cropping ? (
    <CropProps
      onApply={() => handle.current.applyCrop()}
      onCancel={() => handle.current.cancelCrop()}
    />
  ) : active ? (
    <ActiveObjectProps
      object={active}
      multi={active.type === "ActiveSelection"}
      onChange={(props) => handle.current.applyToActive(props)}
      onDelete={() => handle.current.deleteActive()}
      onToggleStyle={(kind) => handle.current.toggleTextStyle(kind)}
      onSetAlign={(align) => handle.current.setTextAlign(align)}
      onReorderLayer={(dir) => handle.current.reorderLayer(dir)}
      onAlignPage={(mode) => handle.current.alignActive(mode)}
      onGroup={() => handle.current.groupSelection()}
      onUngroup={() => handle.current.ungroupSelection()}
      onDuplicate={() => handle.current.duplicateActive()}
      onStartCrop={() => handle.current.startCrop()}
    />
  ) : (
    <DefaultToolProps tool={tool} options={toolOptions} onChange={setToolOptions} />
  );

  return (
    <>
      {/* Desktop: floating card docked to the right, like iLovePDF's
          contextual element panel, rather than a flush full-height sidebar. */}
      <div className="hidden shrink-0 p-3 lg:block lg:w-72">
        <div className="sticky top-3 flex max-h-[calc(100vh-6rem)] flex-col gap-5 overflow-y-auto rounded-xl border border-hair bg-surface p-4 shadow-md">
          <p className="flex items-center gap-2 text-[12.5px] font-semibold text-ink">
            <span className="inline-block size-1.5 rounded-full bg-accent" aria-hidden="true" />
            {title}
          </p>
          {content}
        </div>
      </div>

      {/* Mobile: collapsible bottom sheet so it never crowds the canvas horizontally */}
      <div className="fixed inset-x-0 bottom-0 z-40 lg:hidden">
        <div className="rounded-t-xl border-t border-hair bg-surface shadow-[0_-4px_16px_rgba(0,0,0,0.12)]">
          <button
            onClick={() => setMobileExpanded((v) => !v)}
            aria-expanded={mobileExpanded}
            aria-label={mobileExpanded ? `Tutup panel ${title}` : `Buka panel ${title}`}
            className="flex w-full items-center justify-between px-4 py-2.5"
          >
            <span className="text-[12.5px] font-semibold text-ink">{title}</span>
            <ChevronUp
              className={`size-4 text-muted transition-transform ${mobileExpanded ? "rotate-180" : ""}`}
            />
          </button>
          {mobileExpanded && (
            <div className="max-h-[45vh] overflow-y-auto border-t border-hair px-4 py-4">{content}</div>
          )}
        </div>
      </div>
    </>
  );
}

function CropProps({ onApply, onCancel }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12px] leading-relaxed text-muted">
        Seret dan ubah ukuran kotak biru untuk memilih area gambar yang ingin dipertahankan, lalu terapkan.
      </p>
      <div className="flex gap-2">
        <Button size="sm" icon={Check} onClick={onApply} className="flex-1">
          Terapkan
        </Button>
        <Button variant="secondary" size="sm" icon={X} onClick={onCancel} className="flex-1">
          Batal
        </Button>
      </div>
    </div>
  );
}

function ActiveObjectProps({
  object,
  multi,
  onChange,
  onDelete,
  onToggleStyle,
  onSetAlign,
  onReorderLayer,
  onAlignPage,
  onGroup,
  onUngroup,
  onDuplicate,
  onStartCrop,
}) {
  // Fabric v6+ object `type` values are the PascalCase class names ("IText",
  // "Textbox", "Line", ...), not the old v5 lowercase/kebab-case strings —
  // matching those instead meant this panel's text controls (and the
  // bold/italic/underline/align controls) never actually appeared.
  const isText = ["IText", "Text", "Textbox"].includes(object.type);
  const isImage = object.type === "Image";
  const isGroup = object.type === "Group";
  const isLine = object.type === "Line";
  const isBold = object.fontWeight === "bold" || object.fontWeight === "bolder" || Number(object.fontWeight) >= 600;
  const isItalic = object.fontStyle === "italic" || object.fontStyle === "oblique";

  return (
    <div className="flex flex-col gap-4">
      {isText && (
        <>
          <Field label="Isi teks">
            <textarea
              value={object.text || ""}
              onChange={(e) => onChange({ text: e.target.value })}
              rows={2}
              className="w-full resize-none rounded-md border-hair bg-base px-2.5 py-1.5 text-[13px] text-ink"
            />
          </Field>
          <Field label="Format teks">
            <div className="flex flex-wrap items-center gap-1">
              <StyleToggleButton icon={Bold} active={isBold} label="Tebal (Bold)" onClick={() => onToggleStyle("bold")} />
              <StyleToggleButton icon={Italic} active={isItalic} label="Miring (Italic)" onClick={() => onToggleStyle("italic")} />
              <StyleToggleButton icon={Underline} active={!!object.underline} label="Garis bawah (Underline)" onClick={() => onToggleStyle("underline")} />
              <StyleToggleButton icon={Strikethrough} active={!!object.linethrough} label="Coret (Strikethrough)" onClick={() => onToggleStyle("strikethrough")} />
              <div className="mx-1 h-5 w-px bg-[var(--border)]" />
              <StyleToggleButton icon={AlignLeft} active={(object.textAlign || "left") === "left"} label="Rata kiri" onClick={() => onSetAlign("left")} />
              <StyleToggleButton icon={AlignCenter} active={object.textAlign === "center"} label="Rata tengah" onClick={() => onSetAlign("center")} />
              <StyleToggleButton icon={AlignRight} active={object.textAlign === "right"} label="Rata kanan" onClick={() => onSetAlign("right")} />
              <StyleToggleButton icon={AlignJustify} active={object.textAlign === "justify"} label="Rata kiri-kanan" onClick={() => onSetAlign("justify")} />
            </div>
          </Field>
          <Field label="Jenis font">
            <select
              value={object.fontFamily || FONT_FAMILIES[0].value}
              onChange={(e) => onChange({ fontFamily: e.target.value })}
              className="w-full rounded-md border-hair bg-base px-2.5 py-1.5 text-[13px] text-ink"
            >
              {FONT_FAMILIES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Ukuran font">
            <FontSizeControl value={object.fontSize || 20} onChange={(v) => onChange({ fontSize: v })} />
          </Field>
          <Field label="Spasi baris">
            <select
              value={object.lineHeight || 1.16}
              onChange={(e) => onChange({ lineHeight: Number(e.target.value) })}
              className="w-full rounded-md border-hair bg-base px-2.5 py-1.5 text-[13px] text-ink"
            >
              {LINE_SPACINGS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Warna teks">
            <ColorInput value={object.fill || "#000000"} onChange={(v) => onChange({ fill: v })} />
          </Field>
          <Field label="Sorot teks (Highlight)">
            <ColorInput
              value={
                object.textBackgroundColor && object.textBackgroundColor !== "transparent"
                  ? toHex(object.textBackgroundColor)
                  : "#fef08a"
              }
              onChange={(v) => onChange({ textBackgroundColor: v })}
              allowNone
              isNone={!object.textBackgroundColor || object.textBackgroundColor === "transparent"}
              onNone={() => onChange({ textBackgroundColor: "" })}
            />
          </Field>
        </>
      )}

      {!isText && (
        <>
          <Field label="Warna garis">
            <ColorInput
              value={toHex(object.stroke) || "#7a4423"}
              onChange={(v) => onChange({ stroke: v })}
            />
          </Field>
          {!isLine && (
            <Field label="Warna isi">
              <ColorInput
                value={object.fill && object.fill !== "transparent" ? toHex(object.fill) : "#ffffff"}
                onChange={(v) => onChange({ fill: v })}
                allowNone
                isNone={!object.fill || object.fill === "transparent"}
                onNone={() => onChange({ fill: "transparent" })}
              />
            </Field>
          )}
          <Field label={`Ketebalan garis (${object.strokeWidth || 1}px)`}>
            <input
              type="range"
              min={1}
              max={20}
              value={object.strokeWidth || 1}
              onChange={(e) => onChange({ strokeWidth: Number(e.target.value) })}
              className="w-full accent-[var(--accent)]"
            />
          </Field>
        </>
      )}

      <Field label={`Opacity (${Math.round((object.opacity ?? 1) * 100)}%)`}>
        <input
          type="range"
          min={10}
          max={100}
          value={Math.round((object.opacity ?? 1) * 100)}
          onChange={(e) => onChange({ opacity: Number(e.target.value) / 100 })}
          className="w-full accent-[var(--accent)]"
        />
      </Field>

      {isImage && (
        <Field label="Gambar">
          <Button variant="secondary" size="sm" icon={Crop} onClick={onStartCrop} className="w-full">
            Potong (Crop)
          </Button>
        </Field>
      )}

      {!multi && (
        <Field label="Susunan lapisan">
          <div className="flex items-center gap-1">
            <StyleToggleButton icon={BringToFront} label="Ke depan sekali" onClick={() => onReorderLayer("front")} />
            <StyleToggleButton icon={ChevronUp} label="Maju satu lapis" onClick={() => onReorderLayer("forward")} />
            <StyleToggleButton icon={ChevronDown} label="Mundur satu lapis" onClick={() => onReorderLayer("backward")} />
            <StyleToggleButton icon={SendToBack} label="Ke belakang sekali" onClick={() => onReorderLayer("back")} />
          </div>
        </Field>
      )}

      <Field label="Ratakan ke halaman">
        <div className="grid grid-cols-3 gap-1">
          <StyleToggleButton icon={AlignHorizontalJustifyStart} label="Rata kiri halaman" onClick={() => onAlignPage("left")} />
          <StyleToggleButton icon={AlignHorizontalJustifyCenter} label="Tengah horizontal" onClick={() => onAlignPage("center-h")} />
          <StyleToggleButton icon={AlignHorizontalJustifyEnd} label="Rata kanan halaman" onClick={() => onAlignPage("right")} />
          <StyleToggleButton icon={AlignVerticalJustifyStart} label="Rata atas halaman" onClick={() => onAlignPage("top")} />
          <StyleToggleButton icon={AlignVerticalJustifyCenter} label="Tengah vertikal" onClick={() => onAlignPage("middle-v")} />
          <StyleToggleButton icon={AlignVerticalJustifyEnd} label="Rata bawah halaman" onClick={() => onAlignPage("bottom")} />
        </div>
      </Field>

      <div className="flex gap-2">
        {multi ? (
          <Button variant="secondary" size="sm" icon={GroupIcon} onClick={onGroup} className="flex-1">
            Gabungkan
          </Button>
        ) : isGroup ? (
          <Button variant="secondary" size="sm" icon={UngroupIcon} onClick={onUngroup} className="flex-1">
            Pisahkan
          </Button>
        ) : (
          <Button variant="secondary" size="sm" icon={Copy} onClick={onDuplicate} className="flex-1">
            Duplikat
          </Button>
        )}
      </div>

      <Button variant="danger" size="sm" icon={Trash2} onClick={onDelete}>
        Hapus elemen
      </Button>
    </div>
  );
}

function DefaultToolProps({ tool, options, onChange }) {
  const showsShapeOptions = ["draw", "highlight", "rect", "circle", "line", "text"].includes(tool);

  if (!showsShapeOptions) {
    return (
      <p className="text-[12.5px] leading-relaxed text-muted">
        Pilih sebuah elemen di kanvas untuk mengubah propertinya, atau pilih alat gambar di toolbar atas.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Field label="Warna">
        <ColorInput value={options.color} onChange={(v) => onChange({ color: v })} />
      </Field>
      {tool !== "text" && (
        <Field label={`Ketebalan (${options.strokeWidth}px)`}>
          <input
            type="range"
            min={1}
            max={20}
            value={options.strokeWidth}
            onChange={(e) => onChange({ strokeWidth: Number(e.target.value) })}
            className="w-full accent-[var(--accent)]"
          />
        </Field>
      )}
      {tool === "text" && (
        <>
          <Field label="Jenis font">
            <select
              value={options.fontFamily || FONT_FAMILIES[0].value}
              onChange={(e) => onChange({ fontFamily: e.target.value })}
              className="w-full rounded-md border-hair bg-base px-2.5 py-1.5 text-[13px] text-ink"
            >
              {FONT_FAMILIES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Ukuran font">
            <FontSizeControl value={options.fontSize} onChange={(v) => onChange({ fontSize: v })} />
          </Field>
          <Field label="Spasi baris">
            <select
              value={options.lineHeight || 1.16}
              onChange={(e) => onChange({ lineHeight: Number(e.target.value) })}
              className="w-full rounded-md border-hair bg-base px-2.5 py-1.5 text-[13px] text-ink"
            >
              {LINE_SPACINGS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Format (untuk teks baru)">
            <div className="flex flex-wrap items-center gap-1">
              <StyleToggleButton icon={Bold} active={options.bold} label="Tebal (Bold)" onClick={() => onChange({ bold: !options.bold })} />
              <StyleToggleButton icon={Italic} active={options.italic} label="Miring (Italic)" onClick={() => onChange({ italic: !options.italic })} />
              <StyleToggleButton icon={Underline} active={options.underline} label="Garis bawah (Underline)" onClick={() => onChange({ underline: !options.underline })} />
              <StyleToggleButton icon={Strikethrough} active={options.strikethrough} label="Coret (Strikethrough)" onClick={() => onChange({ strikethrough: !options.strikethrough })} />
              <div className="mx-1 h-5 w-px bg-[var(--border)]" />
              <StyleToggleButton icon={AlignLeft} active={(options.align || "left") === "left"} label="Rata kiri" onClick={() => onChange({ align: "left" })} />
              <StyleToggleButton icon={AlignCenter} active={options.align === "center"} label="Rata tengah" onClick={() => onChange({ align: "center" })} />
              <StyleToggleButton icon={AlignRight} active={options.align === "right"} label="Rata kanan" onClick={() => onChange({ align: "right" })} />
              <StyleToggleButton icon={AlignJustify} active={options.align === "justify"} label="Rata kiri-kanan" onClick={() => onChange({ align: "justify" })} />
            </div>
          </Field>
          <Field label="Sorot teks (Highlight)">
            <ColorInput
              value={options.highlightColor && options.highlightColor !== "transparent" ? options.highlightColor : "#fef08a"}
              onChange={(v) => onChange({ highlightColor: v })}
              allowNone
              isNone={!options.highlightColor || options.highlightColor === "transparent"}
              onNone={() => onChange({ highlightColor: "transparent" })}
            />
          </Field>
        </>
      )}
      <p className="text-[12px] leading-relaxed text-muted">
        {tool === "editText" && "Klik tepat di atas teks asli di PDF untuk mengedit atau menghapusnya."}
        {tool === "text" && "Klik di kanvas untuk menempatkan teks baru."}
        {tool === "draw" && "Klik dan seret untuk menggambar bebas."}
        {tool === "highlight" && "Klik dan seret untuk menyorot area."}
        {tool === "rect" && "Klik dan seret untuk menggambar persegi."}
        {tool === "circle" && "Klik dan seret untuk menggambar lingkaran."}
        {tool === "line" && "Klik dan seret untuk menggambar garis."}
      </p>
    </div>
  );
}

/** Word's font-size box: a free-typed number plus a dropdown of common presets, kept in sync. */
function FontSizeControl({ value, onChange }) {
  const rounded = Math.round(value || 20);
  const clamp = (n) => Math.min(400, Math.max(1, n));
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        min={1}
        max={400}
        value={rounded}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n) && n > 0) onChange(clamp(n));
        }}
        className="w-16 shrink-0 rounded-md border-hair bg-base px-2 py-1.5 text-[13px] text-ink"
      />
      <select
        value={FONT_SIZES.includes(rounded) ? rounded : ""}
        onChange={(e) => e.target.value && onChange(Number(e.target.value))}
        className="w-full rounded-md border-hair bg-base px-2.5 py-1.5 text-[13px] text-ink"
      >
        <option value="" disabled>
          Preset...
        </option>
        {FONT_SIZES.map((s) => (
          <option key={s} value={s}>
            {s}pt
          </option>
        ))}
      </select>
    </div>
  );
}

function StyleToggleButton({ icon: Icon, active, label, onClick }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`flex size-7 items-center justify-center rounded-md transition-colors ${
        active ? "bg-accent text-accent-ink" : "text-muted hover:bg-surface-2 hover:text-ink"
      }`}
    >
      <Icon className="size-[15px]" />
    </button>
  );
}

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12px] font-medium text-muted">{label}</label>
      {children}
    </div>
  );
}

function ColorInput({ value, onChange, allowNone, isNone, onNone }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="size-8 shrink-0 cursor-pointer rounded border-hair bg-transparent p-0.5"
      />
      <span className="font-mono text-[11px] text-muted">{value}</span>
      {allowNone && (
        <button
          onClick={onNone}
          className={`ml-auto rounded px-2 py-1 text-[11px] ${
            isNone ? "bg-surface-2 text-ink" : "text-muted hover:text-ink"
          }`}
        >
          Tanpa isi
        </button>
      )}
    </div>
  );
}

function toHex(color) {
  if (!color) return "#000000";
  if (color.startsWith("#")) return color;
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return "#000000";
  const [, r, g, b] = m;
  return `#${[r, g, b].map((n) => Number(n).toString(16).padStart(2, "0")).join("")}`;
}
