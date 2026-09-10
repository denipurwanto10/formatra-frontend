import { useRef, useState } from "react";
import Modal from "../../../components/ui/Modal";
import Button from "../../../components/ui/Button";

export default function SignaturePad({ open, onClose, onConfirm }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const [hasStroke, setHasStroke] = useState(false);

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const point = e.touches ? e.touches[0] : e;
    return { x: point.clientX - rect.left, y: point.clientY - rect.top };
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
    const ctx = canvasRef.current.getContext("2d");
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.strokeStyle = "#12141a";
    ctx.lineWidth = 2.5;
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
      <canvas
        ref={canvasRef}
        width={400}
        height={180}
        className="w-full touch-none rounded-md border-hair bg-white"
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
      />
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
