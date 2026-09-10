import { useEffect, useState } from "react";
import { FileCheck2, Info } from "lucide-react";
import ToolPageHeader from "../../components/tool/ToolPageHeader";
import ResultCard from "../../components/tool/ResultCard";
import Dropzone from "../../components/ui/Dropzone";
import Button from "../../components/ui/Button";
import ProgressBar from "../../components/ui/ProgressBar";
import ProcessingCard from "../../components/ui/ProcessingCard";
import ErrorState from "../../components/ui/ErrorState";
import { TOOLS } from "../../lib/toolsMeta";
import { useToolProcess } from "../../hooks/useToolProcess";
import { useToast } from "../../context/ToastContext";
import { inspectPdfForm, fillPdfForm } from "../tools/pdfForm";
import { withSuffix } from "../../utils/download";

export default function FormTool() {
  const tool = TOOLS["fill-form"];
  const [file, setFile] = useState(null);
  const [fields, setFields] = useState(null); // null = not inspected yet
  const [values, setValues] = useState({});
  const [flatten, setFlatten] = useState(true);
  const [inspecting, setInspecting] = useState(false);
  const { status, progress, result, error, run, reset, cancel } = useToolProcess(tool);
  const toast = useToast();

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    setInspecting(true);
    inspectPdfForm(file)
      .then(({ fields: found }) => {
        if (cancelled) return;
        setFields(found);
        const initial = {};
        found.forEach((f) => {
          initial[f.name] = f.value;
        });
        setValues(initial);
      })
      .catch(() => {
        if (!cancelled) setFields([]);
      })
      .finally(() => {
        if (!cancelled) setInspecting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [file]);

  const handleReset = () => {
    reset();
    setFile(null);
    setFields(null);
    setValues({});
  };

  const setValue = (name, value) => setValues((v) => ({ ...v, [name]: value }));

  const handleFill = async () => {
    try {
      const blob = await run(
        (onProgress) => fillPdfForm(file, values, { flatten }, onProgress),
        file.name
      );
      toast.success("Formulir PDF berhasil diisi");
      return blob;
    } catch (e) {
      toast.error("Gagal mengisi formulir", e?.message);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 lg:px-8">
      <ToolPageHeader tool={tool} />

      {status === "done" && result && (
        <ResultCard files={[{ name: withSuffix(file.name, "terisi"), blob: result }]} onReset={handleReset} />
      )}
      {status === "error" && <ErrorState description={error} onRetry={handleReset} />}

      {(status === "idle" || status === "processing") && (
        <div className="flex flex-col gap-4">
          {!file ? (
            <Dropzone accept={tool.accept} onFiles={(fs) => setFile(fs[0])} />
          ) : inspecting ? (
            <ProgressBar value={40} label="Membaca kolom formulir..." />
          ) : fields && fields.length === 0 ? (
            <div className="flex gap-2.5 rounded-md border-hair bg-surface-2 px-3.5 py-4">
              <Info className="mt-0.5 size-4 shrink-0 text-accent" />
              <div className="text-[12.5px] leading-relaxed text-muted">
                PDF ini tidak memiliki kolom formulir (AcroForm) yang bisa diisi. Gunakan Edit
                PDF untuk menambahkan teks bebas di atas dokumen.
                <div className="mt-2">
                  <Button size="sm" variant="secondary" onClick={handleReset}>
                    Coba file lain
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            fields && (
              <>
                <div className="flex flex-col gap-3 rounded-md border-hair bg-surface p-4">
                  {fields.map((f) => (
                    <FormField key={f.name} field={f} value={values[f.name]} onChange={(v) => setValue(f.name, v)} />
                  ))}
                </div>

                <label className="flex items-center gap-2 text-[12.5px] text-muted">
                  <input
                    type="checkbox"
                    checked={flatten}
                    onChange={(e) => setFlatten(e.target.checked)}
                    className="accent-[var(--accent)]"
                  />
                  Kunci isian setelah disimpan (tidak bisa diedit lagi)
                </label>

                {status === "processing" ? (
                  <ProcessingCard file={file} progress={progress} label="Menyimpan formulir..." onCancel={cancel} />
                ) : (
                  <Button icon={FileCheck2} onClick={handleFill}>
                    Simpan Formulir
                  </Button>
                )}
              </>
            )
          )}
        </div>
      )}
    </div>
  );
}

function FormField({ field, value, onChange }) {
  const label = field.name;

  if (field.type === "checkbox") {
    return (
      <label className="flex items-center gap-2 text-[13px] text-ink">
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
          className="accent-[var(--accent)]"
        />
        {label}
      </label>
    );
  }

  if (field.type === "radio" || field.type === "dropdown") {
    return (
      <div className="flex flex-col gap-1.5">
        <label className="text-[12.5px] font-medium text-muted">{label}</label>
        <select
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className="rounded-md border-hair bg-surface px-2.5 py-2 text-[13px] text-ink outline-none focus:border-accent"
        >
          <option value="">— Pilih —</option>
          {(field.options || []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12.5px] font-medium text-muted">{label}</label>
      <input
        type="text"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border-hair bg-surface px-2.5 py-2 text-[13px] text-ink outline-none focus:border-accent"
      />
    </div>
  );
}
