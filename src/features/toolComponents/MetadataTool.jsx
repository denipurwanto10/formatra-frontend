import { useEffect, useState } from "react";
import { Tags } from "lucide-react";
import ToolPageHeader from "../../components/tool/ToolPageHeader";
import ResultCard from "../../components/tool/ResultCard";
import Dropzone from "../../components/ui/Dropzone";
import FileListItem from "../../components/ui/FileListItem";
import Button from "../../components/ui/Button";
import ProcessingCard from "../../components/ui/ProcessingCard";
import ErrorState from "../../components/ui/ErrorState";
import Spinner from "../../components/ui/Spinner";
import { TOOLS } from "../../lib/toolsMeta";
import { useToolProcess } from "../../hooks/useToolProcess";
import { useToast } from "../../context/ToastContext";
import { readMetadata, writeMetadata } from "../tools/editMetadata";
import { withSuffix } from "../../utils/download";

const EMPTY = { title: "", author: "", subject: "", keywords: "", creator: "" };

export default function MetadataTool() {
  const tool = TOOLS["edit-metadata"];
  const [file, setFile] = useState(null);
  const [fields, setFields] = useState(EMPTY);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const { status, progress, result, error, run, reset, cancel } = useToolProcess(tool);
  const toast = useToast();

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    setLoadingMeta(true);
    readMetadata(file)
      .then((meta) => {
        if (!cancelled) setFields({ ...EMPTY, ...meta });
      })
      .catch(() => {
        if (!cancelled) toast.warning("Tidak bisa membaca metadata, formulir dikosongkan");
      })
      .finally(() => {
        if (!cancelled) setLoadingMeta(false);
      });
    return () => {
      cancelled = true;
    };
  }, [file, toast]);

  const handleReset = () => {
    reset();
    setFile(null);
    setFields(EMPTY);
  };

  const set = (key) => (e) => setFields((f) => ({ ...f, [key]: e.target.value }));

  const handleSave = async () => {
    try {
      const blob = await run((onProgress) => writeMetadata(file, fields, onProgress), file.name);
      toast.success("Metadata berhasil disimpan");
      return blob;
    } catch (e) {
      toast.error("Gagal menyimpan metadata", e?.message);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 lg:px-8">
      <ToolPageHeader tool={tool} />

      {status === "done" && result && (
        <ResultCard
          files={[{ name: withSuffix(file.name, "metadata"), blob: result }]}
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

              {loadingMeta ? (
                <div className="flex items-center gap-2 py-6 text-[13px] text-muted">
                  <Spinner size="size-4" /> Membaca metadata...
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <Field label="Judul">
                    <input value={fields.title} onChange={set("title")} className={inputCls} />
                  </Field>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Penulis / Author">
                      <input value={fields.author} onChange={set("author")} className={inputCls} />
                    </Field>
                    <Field label="Aplikasi pembuat (Creator)">
                      <input value={fields.creator} onChange={set("creator")} className={inputCls} />
                    </Field>
                  </div>
                  <Field label="Subjek">
                    <input value={fields.subject} onChange={set("subject")} className={inputCls} />
                  </Field>
                  <Field label="Kata kunci (pisahkan dengan koma)">
                    <input
                      value={fields.keywords}
                      onChange={set("keywords")}
                      placeholder="mis. laporan, keuangan, 2026"
                      className={inputCls}
                    />
                  </Field>
                </div>
              )}

              {status === "processing" ? (
                <ProcessingCard file={file} progress={progress} label="Menyimpan metadata..." onCancel={cancel} />
              ) : (
                <Button icon={Tags} onClick={handleSave} disabled={loadingMeta}>
                  Simpan metadata
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

const inputCls = "w-full rounded-md border-hair bg-base px-3 py-2 text-[13px] text-ink";

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12.5px] font-medium text-muted">{label}</label>
      {children}
    </div>
  );
}
