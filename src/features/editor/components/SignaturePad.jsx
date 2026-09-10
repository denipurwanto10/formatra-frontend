import { useLayoutEffect, useRef, useState } from "react";
import Modal from "../../../components/ui/Modal";
import Button from "../../../components/ui/Button";

// Aspect ratio of the drawing surface (matches SignTool's SIG_ASPECT: h/w).
const ASPECT = 180 / 400;

export default function SignaturePad({ open, onClose, onConfirm }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const [hasStroke, setHasStroke] = useState(false);

  // Keep the canvas's internal pixel resolution in sync with however big it's
  // actually rendered (it's laid out with CSS width:100%, so on a narrow
  // phone screen it's nowhere near a fixed 400px). Without this, pointer
  // coordinates are read in on-screen pixels but drawn into a canvas whose
  // coordinate space is still 400x180, so strokes land in the wrong place —
  // that's what makes drawing feel broken/unresponsive on mobile.
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!open || !wrap || !canvas) return;

    const resize = () => {
      const width = Math.max(1, Math.round(wrap.clientWidth));
      const height = Math.max(1, Math.round(width * ASPECT));
      if (canvas.width === width && canvas.height === height) return;

      // Resizing a canvas clears it, so preserve any existing strokes by
      // redrawing the previous bitmap scaled into the new dimensions.
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
  }, [open]);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const point = e.touches ? e.touches[0] : e;
    // Scale from on-screen (CSS) pixels to the canvas's own coordinate
    // space, since its rendered size and internal resolution can differ.
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
    // Scale stroke width with the canvas so it looks the same weight
    // whether drawn on a small phone or a wide desktop modal.
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
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasStroke(false);
  };

  const confirm = () => {
    if (!hasStroke) return;
    onConfirm(canvasRef.current.toDataURL("image/png"));
    clear();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Tambah Tanda Tangan" width={460}>
      <p className="mb-3 text-[12.5px] text-muted">
        Gambar tanda tangan Anda di area berikut menggunakan mouse atau layar sentuh.
      </p>
      <div ref={wrapRef} style={{ aspectRatio: "400 / 180" }} className="w-full">
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
      <div className="mt-3 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={clear}>
          Bersihkan
        </Button>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Batal
          </Button>
          <Button size="sm" disabled={!hasStroke} onClick={confirm}>
            Gunakan tanda tangan
          </Button>
        </div>
      </div>
    </Modal>
  );
}
