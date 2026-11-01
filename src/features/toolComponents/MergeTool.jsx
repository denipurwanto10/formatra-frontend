import { useState } from "react";
import { Combine } from "lucide-react";
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
import { mergePdfs } from "../tools/mergePdf";

export default function MergeTool() {
  const tool = TOOLS["merge-pdf"];
  const [files, setFiles] = useState([]);
  const { status, progress, result, error, run, reset, cancel } = useToolProcess(tool);
  const toast = useToast();

  const addFiles = (newFiles) => setFiles((prev) => [...prev, ...newFiles]);
  const removeFile = (idx) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const moveFile = (from, to) => {
    setFiles((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  const handleReset = () => {
    reset();
    setFiles([]);
  };

  const handleMerge = async () => {
    try {
      const blob = await run((onProgress) => mergePdfs(files, onProgress), `${files.length} file`);
      toast.success("PDF berhasil digabung", `${files.length} file digabung menjadi satu.`);
      return blob;
    } catch {
      toast.error("Gagal menggabungkan PDF", "Pastikan semua file adalah PDF yang valid.");
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 lg:px-8">
      <ToolPageHeader tool={tool} />

      {status === "done" && result && (
        <ResultCard
          files={[{ name: "dokumen-gabungan.pdf", blob: result }]}
          onReset={handleReset}
        />
      )}

      {status === "error" && (
        <ErrorState description={error} onRetry={handleReset} />
      )}

      {(status === "idle" || status === "processing") && (
        <div className="flex flex-col gap-4">
          <Dropzone
            accept={tool.accept}
            multiple
            onFiles={addFiles}
            hint="Bisa pilih beberapa file PDF sekaligus"
          />

          {files.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-[13px] text-muted">
                Urutan file menentukan urutan halaman di hasil akhir. Seret untuk menyusun ulang.
              </p>
              {files.map((file, idx) => (
                <div
                  key={`${file.name}-${idx}`}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", String(idx))}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    const from = Number(e.dataTransfer.getData("text/plain"));
                    moveFile(from, idx);
                  }}
                >
                  <FileListItem
                    file={file}
                    index={idx}
                    draggable
                    onRemove={() => removeFile(idx)}
                  />
                </div>
              ))}
            </div>
          )}

          {status === "processing" ? (
            <ProcessingCard
              file={{
                name: `${files.length} file digabungkan`,
                size: files.reduce((sum, f) => sum + f.size, 0),
              }}
              progress={progress}
              label="Menggabungkan file..."
              onCancel={cancel}
            />
          ) : (
            <Button
              icon={Combine}
              disabled={files.length < 2}
              onClick={handleMerge}
            >
              Gabung {files.length > 0 ? `${files.length} file` : "PDF"}
            </Button>
          )}
          {files.length === 1 && (
            <p className="text-xs text-muted">Tambahkan minimal 2 file untuk digabung.</p>
          )}
        </div>
      )}
    </div>
  );
}
