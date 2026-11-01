import { useState } from "react";
import { Hash } from "lucide-react";
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
import { addPageNumbers } from "../tools/pageNumbers";
import { withSuffix } from "../../utils/download";

const POSITIONS = [
  { id: "bottom-center", label: "Bawah tengah" },
  { id: "bottom-right", label: "Bawah kanan" },
  { id: "bottom-left", label: "Bawah kiri" },
  { id: "top-center", label: "Atas tengah" },
  { id: "top-right", label: "Atas kanan" },
  { id: "top-left", label: "Atas kiri" },
];

const FORMATS = [
  { id: "{n} / {total}", label: "1 / 12" },
  { id: "{n}", label: "1" },
  { id: "Halaman {n}", label: "Halaman 1" },
  { id: "Halaman {n} dari {total}", label: "Halaman 1 dari 12" },
  { id: "- {n} -", label: "- 1 -" },
];

export default function PageNumbersTool() {
  const tool = TOOLS["page-numbers"];
  const [file, setFile] = useState(null);
  const [position, setPosition] = useState("bottom-center");
  const [format, setFormat] = useState(FORMATS[0].id);
  const [startAt, setStartAt] = useState(1);
  const [headerText, setHeaderText] = useState("");
  const { status, progress, result, error, run, reset, cancel } = useToolProcess(tool);
  const toast = useToast();

  const handleReset = () => {
    reset();
    setFile(null);
  };

  const handleApply = async () => {
    try {
      const blob = await run((onProgress) =>
        addPageNumbers(
          file,
          { showPageNumbers: true, format, position, headerText, startAt },
          onProgress
        ),
        file.name
      );
      toast.success("Nomor halaman berhasil ditambahkan");
      return blob;
    } catch (e) {
      toast.error("Gagal menambahkan nomor halaman", e?.message);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 lg:px-8">
      <ToolPageHeader tool={tool} />

      {status === "done" && result && (
        <ResultCard
          files={[{ name: withSuffix(file.name, "nomor-halaman"), blob: result }]}
          onReset={handleReset}
        />
      )}
      {status === "error" && <ErrorState description={error} onRetry={handleReset} />}

      {(status === "idle" || status === "processing") && (
        <div className="flex flex-col gap-4">
          {!file ? (
            <Dropzone accept={tool.accept} onFiles={(fs) => setFile(fs[0])} />
          ) : (
            <>
              {status !== "processing" && <FileListItem file={file} onRemove={handleReset} />}

              <Field label="Format nomor halaman">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {FORMATS.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setFormat(f.id)}
                      className={`rounded-md border-hair px-3 py-2 text-left text-[12.5px] font-medium transition-colors ${
                        format === f.id
                          ? "border-accent bg-accent/5 text-ink"
                          : "text-muted hover:text-ink"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Posisi">
                <select
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  className="w-full rounded-md border-hair bg-base px-3 py-2 text-[13px] text-ink"
                >
                  {POSITIONS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Mulai dari nomor">
                  <input
                    type="number"
                    min={0}
                    value={startAt}
                    onChange={(e) => setStartAt(Number(e.target.value) || 1)}
                    className="w-full rounded-md border-hair bg-base px-3 py-2 text-[13px] text-ink"
                  />
                </Field>
                <Field label="Teks header (opsional)">
                  <input
                    value={headerText}
                    onChange={(e) => setHeaderText(e.target.value)}
                    placeholder="mis. nama dokumen"
                    className="w-full rounded-md border-hair bg-base px-3 py-2 text-[13px] text-ink"
                  />
                </Field>
              </div>

              {status === "processing" ? (
                <ProcessingCard file={file} progress={progress} label="Menambahkan nomor halaman..." onCancel={cancel} />
              ) : (
                <Button icon={Hash} onClick={handleApply}>
                  Tambahkan nomor halaman
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
