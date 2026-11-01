import { useLayoutEffect, useRef, useState } from "react";
import Modal from "../../../components/ui/Modal";
import Button from "../../../components/ui/Button";

// Aspect ratio of the drawing surface (h/w). Initials get a squarer box
// since they're only a couple of letters, not a full signature.
const ASPECT = { signature: 180 / 400, initials: 160 / 260 };

const SCRIPT_FONTS = [
  { label: "Kursif Klasik", value: "'Brush Script MT', 'Segoe Script', cursive" },
  { label: "Kursif Elegan", value: "'Lucida Handwriting', 'Segoe Script', cursive" },
  { label: "Tulisan Tangan", value: "'Segoe Print', 'Comic Sans MS', cursive" },
];

export default function SignaturePad({ open, onClose, onConfirm, mode = "signature" }) {
  const aspect = ASPECT[mode] ?? ASPECT.signature;
  const title = mode === "initials" ? "Tambah Inisial" : "Tambah Tanda Tangan";
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const [hasStroke, setHasStroke] = useState(false);
  const [inputMode, setInputMode] = useState("draw"); // "draw" | "type"
  const [typedText, setTypedText] = useState("");
  const [font, setFont] = useState(SCRIPT_FONTS[0].value);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!open || inputMode !== "draw" || !wrap || !canvas) return;

    const resize = () => {
      const width = Math.max(1, Math.round(wrap.clientWidth));
      const height = Math.max(1, Math.round(width * aspect));
      if (canvas.width === width && canvas.height === height) return;

      const prevDataUrl = hasStroke ? canvas.toDataURL("image/png") : null;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (prevDataUrl) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0, width, height);
        img.src = prevDataUrl;
      }
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, inputMode, aspect]);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const point = e.touches ? e.touches[0] : e;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (point.clientX - rect.left) * scaleX,
      y: (point.clientY - rect.top) * scaleY,
    };
  };

  const start = (e) => {
    drawingRef.current = true;
    const ctx = canvasRef.current.getContext("2d");
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (e) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const { x, y } = getPos(e);
    const scale = canvas.width / 400;
    ctx.lineTo(x, y);
    ctx.strokeStyle = "#12141a";
    ctx.lineWidth = 2.5 * scale;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    setHasStroke(true);
  };

  const end = () => {
    drawingRef.current = false;
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasStroke(false);
  };

  // Renders the typed name/initials into a PNG using the chosen script
  // font, so it goes through the exact same onConfirm(dataUrl) → "add as
  // image" pipeline as a drawn signature — no separate handling needed
  // anywhere else in the app, including on export.
  const renderTypedToDataUrl = () => {
    const width = 500;
    const height = Math.round(width * aspect);
    const off = document.createElement("canvas");
    off.width = width;
    off.height = height;
    const ctx = off.getContext("2d");
    ctx.clearRect(0, 0, width, height);
    let size = Math.round(height * 0.55);
    ctx.fillStyle = "#12141a";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // Shrink the font until the text fits the box, so long names don't spill.
    do {
      ctx.font = `${size}px ${font}`;
      const w = ctx.measureText(typedText).width;
      if (w <= width * 0.9) break;
      size -= 2;
    } while (size > 10);
    ctx.fillText(typedText, width / 2, height / 2);
    return off.toDataURL("image/png");
  };

  const canConfirm = inputMode === "draw" ? hasStroke : typedText.trim().length > 0;

  const confirm = () => {
    if (!canConfirm) return;
    const dataUrl = inputMode === "draw" ? canvasRef.current.toDataURL("image/png") : renderTypedToDataUrl();
    onConfirm(dataUrl);
    clear();
    setTypedText("");
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={title} width={460}>
      <div className="mb-3 flex gap-1 rounded-lg bg-surface-2 p-0.5">
        <button
          type="button"
          onClick={() => setInputMode("draw")}
          className={`flex-1 rounded-md py-1.5 text-[12.5px] font-medium ${
            inputMode === "draw" ? "bg-surface text-ink shadow-sm" : "text-muted"
          }`}
        >
          Gambar
        </button>
        <button
          type="button"
          onClick={() => setInputMode("type")}
          className={`flex-1 rounded-md py-1.5 text-[12.5px] font-medium ${
            inputMode === "type" ? "bg-surface text-ink shadow-sm" : "text-muted"
          }`}
        >
          Ketik
        </button>
      </div>

      {inputMode === "draw" ? (
        <>
          <p className="mb-3 text-[12.5px] text-muted">
            Gambar {mode === "initials" ? "inisial" : "tanda tangan"} Anda di area berikut menggunakan mouse atau
            layar sentuh.
          </p>
          <div ref={wrapRef} style={{ aspectRatio: `1 / ${aspect}` }} className="w-full">
            <canvas
              ref={canvasRef}
              className="block h-full w-full touch-none rounded-md border-hair bg-white"
              onMouseDown={start}
              onMouseMove={move}
              onMouseUp={end}
              onMouseLeave={end}
              onTouchStart={start}
              onTouchMove={move}
              onTouchEnd={end}
            />
          </div>
        </>
      ) : (
        <>
          <p className="mb-3 text-[12.5px] text-muted">
            Ketik {mode === "initials" ? "inisial" : "nama"} Anda, lalu pilih gaya tulisan tangan yang paling mirip.
          </p>
          <input
            type="text"
            value={typedText}
            onChange={(e) => setTypedText(e.target.value)}
            placeholder={mode === "initials" ? "Contoh: DP" : "Contoh: Deni Purwanto"}
            maxLength={mode === "initials" ? 6 : 60}
            className="mb-3 w-full rounded-md border border-hair bg-surface px-3 py-2 text-[13px] outline-none focus:border-accent"
          />
          <div className="mb-3 flex flex-wrap gap-2">
            {SCRIPT_FONTS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFont(f.value)}
                className={`rounded-full border px-3 py-1 text-[11.5px] ${
                  font === f.value ? "border-accent bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]" : "border-hair text-muted"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div
            style={{ aspectRatio: `1 / ${aspect}`, fontFamily: font }}
            className="flex w-full items-center justify-center rounded-md border border-hair bg-white px-4 text-center text-3xl text-[#12141a]"
          >
            {typedText || <span className="text-base text-muted">Pratinjau akan muncul di sini</span>}
          </div>
        </>
      )}

      <div className="mt-3 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={inputMode === "draw" ? clear : () => setTypedText("")}>
          Bersihkan
        </Button>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Batal
          </Button>
          <Button size="sm" disabled={!canConfirm} onClick={confirm}>
            Gunakan {mode === "initials" ? "inisial" : "tanda tangan"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
