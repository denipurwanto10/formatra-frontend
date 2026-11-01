import { useState } from "react";
import { Stamp } from "lucide-react";
import ToolPageHeader from "../../components/tool/ToolPageHeader";
import ResultCard from "../../components/tool/ResultCard";
import Dropzone from "../../components/ui/Dropzone";
import FileListItem from "../../components/ui/FileListItem";
import Button from "../../components/ui/Button";
import ProcessingCard from "../../components/ui/ProcessingCard";
import ErrorState from "../../components/ui/ErrorState";
import { TOOLS } from "../../lib/toolsMeta";
import { useToolProcess } from "../../hooks/useToolProcess";
import { useToast } from "../../context/ToastContext";
import { watermarkPdf } from "../tools/watermarkPdf";

const LAYOUTS = [
  { id: "diagonal", label: "Diagonal" },
  { id: "center", label: "Tengah" },
  { id: "tiled", label: "Berulang" },
];

export default function WatermarkTool() {
  const tool = TOOLS["watermark-pdf"];
  const [file, setFile] = useState(null);
  const [text, setText] = useState("RAHASIA");
  const [layout, setLayout] = useState("diagonal");
  const [opacity, setOpacity] = useState(25);
  const [fontSize, setFontSize] = useState(48);
  const { status, progress, result, error, run, reset, cancel } = useToolProcess(tool);
  const toast = useToast();

  const handleReset = () => {
    reset();
    setFile(null);
  };

  const handleApply = async () => {
    if (!text.trim()) {
      toast.warning("Isi teks watermark terlebih dahulu");
      return;
    }
    try {
      const blob = await run((onProgress) =>
        watermarkPdf(
          file,
          { text, layout, opacity: opacity / 100, fontSize, rotation: layout === "center" ? 0 : -35 },
          onProgress
        ),
        file.name
      );
      toast.success("Watermark berhasil ditambahkan");
      return blob;
    } catch {
      toast.error("Gagal menambahkan watermark");
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 lg:px-8">
      <ToolPageHeader tool={tool} />

      {status === "done" && result && (
        <ResultCard files={[{ name: "dokumen-watermark.pdf", blob: result }]} onReset={handleReset} />
      )}
      {status === "error" && <ErrorState description={error} onRetry={handleReset} />}

      {(status === "idle" || status === "processing") && (
        <div className="flex flex-col gap-4">
          {!file ? (
            <Dropzone accept={tool.accept} onFiles={(fs) => setFile(fs[0])} />
          ) : (
            <>
              {status !== "processing" && <FileListItem file={file} onRemove={handleReset} />}

              <Field label="Teks watermark">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="w-full rounded-md border-hair bg-base px-3 py-2 text-[13px] text-ink"
                  placeholder="mis. RAHASIA, DRAFT, CONTOH"
                />
              </Field>

              <Field label="Tata letak">
                <div className="flex gap-2 rounded-md bg-surface-2 p-1">
                  {LAYOUTS.map((l) => (
                    <button
                      key={l.id}
                      onClick={() => setLayout(l.id)}
                      className={`flex-1 rounded px-3 py-1.5 text-[13px] font-medium transition-colors ${
                        layout === l.id ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </Field>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label={`Transparansi (${opacity}%)`}>
                  <input
                    type="range"
                    min={5}
                    max={80}
                    value={opacity}
                    onChange={(e) => setOpacity(Number(e.target.value))}
                    className="w-full accent-[var(--accent)]"
                  />
                </Field>
                <Field label={`Ukuran teks (${fontSize}pt)`}>
                  <input
                    type="range"
                    min={16}
                    max={96}
                    value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                    className="w-full accent-[var(--accent)]"
                  />
                </Field>
              </div>

              {status === "processing" ? (
                <ProcessingCard file={file} progress={progress} label="Menambahkan watermark..." onCancel={cancel} />
              ) : (
                <Button icon={Stamp} onClick={handleApply}>
                  Tambahkan watermark
                </Button>
              )}
            </>
          )}
        </div>
      )}
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
