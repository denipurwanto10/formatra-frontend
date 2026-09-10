import { useState } from "react";
import { ImageIcon } from "lucide-react";
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
import { pdfToImages } from "../tools/pdfToImages";
import { downloadBlob } from "../../utils/download";

export default function PdfToImagesTool() {
  const tool = TOOLS["pdf-to-image"];
  const [file, setFile] = useState(null);
  const [format, setFormat] = useState("png");
  const [quality, setQuality] = useState("high");
  const { status, progress, result, error, run, reset, cancel } = useToolProcess(tool);
  const toast = useToast();

  const handleReset = () => {
    reset();
    setFile(null);
  };

  const handleConvert = async () => {
    try {
      const scale = quality === "high" ? 3 : quality === "medium" ? 2 : 1.2;
      const output = await run((onProgress) =>
        pdfToImages(file, { format, scale, quality: 0.9 }, onProgress),
        file.name
      );
      toast.success("Halaman PDF berhasil diekspor sebagai gambar");
      return output;
    } catch {
      toast.error("Gagal mengekspor gambar");
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 lg:px-8">
      <ToolPageHeader tool={tool} />

      {status === "done" && result && (
        <>
          {result.single ? (
            <ResultCard files={[result.single]} onReset={handleReset} />
          ) : (
            <div className="flex flex-col gap-3 rounded-lg border-hair bg-[var(--success-bg)] p-5">
              <p className="text-[13.5px] font-medium text-ink">
                {result.count} halaman berhasil diekspor
              </p>
              <Button
                icon={ImageIcon}
                onClick={() => downloadBlob(result.zip, "halaman-pdf.zip")}
              >
                Unduh semua (.zip)
              </Button>
              <Button variant="ghost" size="sm" onClick={handleReset}>
                Proses file lain
              </Button>
            </div>
          )}
        </>
      )}
      {status === "error" && <ErrorState description={error} onRetry={handleReset} />}

      {(status === "idle" || status === "processing") && (
        <div className="flex flex-col gap-4">
          {!file ? (
            <Dropzone accept={tool.accept} onFiles={(fs) => setFile(fs[0])} />
          ) : (
            <>
              {status !== "processing" && <FileListItem file={file} onRemove={handleReset} />}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Format">
                  <SegButtons
                    options={[{ id: "png", label: "PNG" }, { id: "jpg", label: "JPG" }]}
                    value={format}
                    onChange={setFormat}
                  />
                </Field>
                <Field label="Kualitas">
                  <SegButtons
                    options={[
                      { id: "standard", label: "Standar" },
                      { id: "medium", label: "Tinggi" },
                      { id: "high", label: "Maksimal" },
                    ]}
                    value={quality}
                    onChange={setQuality}
                  />
                </Field>
              </div>

              {status === "processing" ? (
                <ProcessingCard file={file} progress={progress} label="Mengekspor halaman..." onCancel={cancel} />
              ) : (
                <Button icon={ImageIcon} onClick={handleConvert}>
                  Ekspor sebagai {format.toUpperCase()}
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

function SegButtons({ options, value, onChange }) {
  return (
    <div className="flex gap-1 rounded-md bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`flex-1 rounded px-2 py-1.5 text-[12.5px] font-medium ${
            value === o.id ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
