import { useEffect, useMemo, useState } from "react";
import { Eraser, Pipette, RotateCcw } from "lucide-react";
import ToolPageHeader from "../../components/tool/ToolPageHeader";
import ResultCard from "../../components/tool/ResultCard";
import BatchResultList from "../../components/tool/BatchResultList";
import Dropzone from "../../components/ui/Dropzone";
import FileListItem from "../../components/ui/FileListItem";
import Button from "../../components/ui/Button";
import ProcessingCard from "../../components/ui/ProcessingCard";
import ErrorState from "../../components/ui/ErrorState";
import { TOOLS } from "../../lib/toolsMeta";
import { useToolProcess } from "../../hooks/useToolProcess";
import { useBatchProcess } from "../../hooks/useBatchProcess";
import { useToast } from "../../context/ToastContext";
import { removeBackground } from "../tools/removeBackground";
import { replaceExtension } from "../../utils/download";

const CHECKERBOARD_STYLE = {
  backgroundImage:
    "linear-gradient(45deg, #80808022 25%, transparent 25%), linear-gradient(-45deg, #80808022 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #80808022 75%), linear-gradient(-45deg, transparent 75%, #80808022 75%)",
  backgroundSize: "16px 16px",
  backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
};

export default function RemoveBgTool() {
  const tool = TOOLS["remove-bg"];
  const [file, setFile] = useState(null);
  const [tolerance, setTolerance] = useState(30);
  const [feather, setFeather] = useState(15);
  const [samplePoint, setSamplePoint] = useState(null); // {x,y} normalized 0..1, or null = auto-detect from corners

  const options = { tolerance, feather, samplePoint };
  const process = (f, onProgress) => removeBackground(f, options, onProgress);

  const { status, progress, result, error, run, reset, cancel } = useToolProcess(tool);
  const batchProcess = useBatchProcess(process, tool);
  const toast = useToast();

  const outputName = (f) => replaceExtension(f.name, "png");

  const handleReset = () => {
    reset();
    setFile(null);
    setSamplePoint(null);
    batchProcess.reset();
  };

  const handleRemove = async () => {
    try {
      const blob = await run((onProgress) => process(file, onProgress), file.name);
      toast.success("Latar belakang berhasil dihapus");
      return blob;
    } catch (e) {
      toast.error("Gagal menghapus latar belakang", e?.message);
    }
  };

  const handleFiles = (files) => {
    setSamplePoint(null);
    if (files.length > 1) {
      batchProcess.setFiles(files);
    } else {
      setFile(files[0]);
    }
  };

  const isBatchMode = batchProcess.items.length > 0;

  const controls = (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={`Toleransi warna (${tolerance}%)`}>
          <input
            type="range"
            min={5}
            max={80}
            value={tolerance}
            onChange={(e) => setTolerance(Number(e.target.value))}
            className="w-full accent-[var(--accent)]"
          />
          <p className="text-[11.5px] text-muted">Makin tinggi, makin banyak warna mirip yang ikut terhapus.</p>
        </Field>
        <Field label={`Feather / haluskan tepi (${feather}%)`}>
          <input
            type="range"
            min={0}
            max={100}
            value={feather}
            onChange={(e) => setFeather(Number(e.target.value))}
            className="w-full accent-[var(--accent)]"
          />
          <p className="text-[11.5px] text-muted">Melembutkan transisi tepi potongan agar tidak bergerigi.</p>
        </Field>
      </div>
      {!isBatchMode && (
        <p className="text-[12px] text-muted">
          {samplePoint
            ? "Warna latar diambil dari titik yang kamu klik pada gambar di bawah."
            : "Warna latar dideteksi otomatis dari keempat sudut gambar — klik pada bagian latar di pratinjau untuk memilih manual."}
        </p>
      )}
    </div>
  );

  if (isBatchMode) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-8 lg:px-8">
        <ToolPageHeader tool={tool} />
        <p className="mb-4 text-[12px] text-muted">
          Paling cocok untuk gambar dengan latar belakang polos/rata warna (foto produk, pas foto, screenshot). Diproses
          sepenuhnya di browser, tanpa AI dan tanpa unggah ke server.
        </p>
        <div className="mb-4">{controls}</div>
        <BatchResultList
          items={batchProcess.items}
          outputName={outputName}
          zipName="tanpa-latar-belakang.zip"
          onRetry={batchProcess.runOne}
          onRemove={batchProcess.removeItem}
          onRunAll={batchProcess.runAll}
          isProcessing={batchProcess.isProcessing}
          overallProgress={batchProcess.overallProgress}
        />
        <Button variant="ghost" size="sm" className="mt-3" onClick={handleReset}>
          Mulai batch baru
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 lg:px-8">
      <ToolPageHeader tool={tool} />

      {file && (
        <div className="flex flex-col gap-4">
          {status !== "processing" && <FileListItem file={file} onRemove={handleReset} />}

          {status === "done" && result ? (
            <BeforeAfter file={file} result={result} samplePoint={samplePoint} onPick={setSamplePoint} />
          ) : (
            <PickableOriginal file={file} samplePoint={samplePoint} onPick={setSamplePoint} />
          )}

          {controls}

          {status === "processing" ? (
            <ProcessingCard file={file} progress={progress} label="Menghapus latar belakang..." onCancel={cancel} />
          ) : status === "error" ? (
            <ErrorState description={error} onRetry={handleRemove} />
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button icon={status === "done" ? RotateCcw : Eraser} onClick={handleRemove}>
                {status === "done" ? "Proses ulang dengan pengaturan ini" : "Hapus Latar Belakang"}
              </Button>
              {samplePoint && (
                <Button variant="ghost" onClick={() => setSamplePoint(null)}>
                  Reset ke deteksi otomatis
                </Button>
              )}
            </div>
          )}

          {status === "done" && result && (
            <ResultCard files={[{ name: outputName(file), blob: result }]} onReset={handleReset} />
          )}
        </div>
      )}

      {!file && (
        <Dropzone
          accept={tool.accept}
          multiple
          onFiles={handleFiles}
          hint="Bisa pilih beberapa file sekaligus untuk diproses satu per satu"
        />
      )}
    </div>
  );
}

/** Image the user can click to sample the background color from a specific point (no label — callers add their own). */
function ClickableImage({ src, alt, samplePoint, onPick, className = "max-h-80" }) {
  const handleClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    onPick({ x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) });
  };

  return (
    <div className="relative cursor-crosshair overflow-hidden rounded-[var(--radius-md)] border-hair bg-surface">
      <img src={src} alt={alt} onClick={handleClick} className={`w-full select-none object-contain ${className}`} />
      {samplePoint && (
        <span
          className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1.5px_rgba(0,0,0,0.5)]"
          style={{ left: `${samplePoint.x * 100}%`, top: `${samplePoint.y * 100}%` }}
        />
      )}
    </div>
  );
}

/** Original image preview shown before running, with the label explaining the click-to-pick affordance. */
function PickableOriginal({ file, samplePoint, onPick }) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  return (
    <div className="flex flex-col gap-1.5">
      <p className="flex items-center gap-1.5 text-[12px] font-medium text-muted">
        <Pipette className="size-3.5" /> Klik pada latar belakang gambar untuk memilih warnanya (opsional)
      </p>
      <ClickableImage src={url} alt={file.name} samplePoint={samplePoint} onPick={onPick} />
    </div>
  );
}

/** Side-by-side original vs. transparent result, result shown over a checkerboard. */
function BeforeAfter({ file, result, samplePoint, onPick }) {
  const originalUrl = useMemo(() => URL.createObjectURL(file), [file]);
  const resultUrl = useMemo(() => URL.createObjectURL(result), [result]);
  useEffect(() => {
    return () => {
      URL.revokeObjectURL(originalUrl);
      URL.revokeObjectURL(resultUrl);
    };
  }, [originalUrl, resultUrl]);

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="flex flex-col gap-1.5">
        <p className="text-[12px] font-medium text-muted">Sebelum (klik untuk pilih warna latar)</p>
        <ClickableImage
          src={originalUrl}
          alt={file.name}
          samplePoint={samplePoint}
          onPick={onPick}
          className="h-full max-h-[19.5rem]"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="text-[12px] font-medium text-muted">Sesudah</p>
        <div className="overflow-hidden rounded-[var(--radius-md)] border-hair" style={CHECKERBOARD_STYLE}>
          <img src={resultUrl} alt="Sesudah" className="h-full max-h-[19.5rem] w-full object-contain" />
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12.5px] font-medium text-muted">{label}</label>
      {children}
    </div>
  );
}
