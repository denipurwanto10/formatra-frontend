import { useState } from "react";
import { LockOpen, Eye, EyeOff } from "lucide-react";
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
import { unlockPdf } from "../tools/unlockPdf";
import { withSuffix } from "../../utils/download";

export default function UnlockTool() {
  const tool = TOOLS["unlock-pdf"];
  const [file, setFile] = useState(null);
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const { status, progress, result, error, run, reset, cancel } = useToolProcess(tool);
  const toast = useToast();

  const handleReset = () => {
    reset();
    setFile(null);
    setPassword("");
  };

  const handleUnlock = async () => {
    if (!password) {
      toast.warning("Masukkan kata sandi PDF terlebih dahulu");
      return;
    }
    try {
      const blob = await run((onProgress) => unlockPdf(file, password, onProgress), file.name);
      toast.success("Kata sandi berhasil dihapus");
      return blob;
    } catch (e) {
      toast.error("Gagal membuka PDF", e?.message);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 lg:px-8">
      <ToolPageHeader tool={tool} />

      {status === "done" && result && (
        <ResultCard
          files={[{ name: withSuffix(file.name, "terbuka"), blob: result }]}
          onReset={handleReset}
        />
      )}
      {status === "error" && <ErrorState description={error} onRetry={handleReset} />}

      {(status === "idle" || status === "processing") && (
        <div className="flex flex-col gap-4">
          {!file ? (
            <Dropzone
              accept={tool.accept}
              onFiles={(fs) => setFile(fs[0])}
              hint="File tidak pernah dikirim ke server — proses sepenuhnya di browser Anda."
            />
          ) : (
            <>
              {status !== "processing" && <FileListItem file={file} onRemove={handleReset} />}

              <Field label="Kata sandi PDF saat ini">
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-md border-hair bg-base px-3 py-2 pr-9 text-[13px] text-ink"
                    placeholder="Masukkan kata sandi yang mengunci file ini"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                    aria-label={showPw ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                  >
                    {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </Field>

              {status === "processing" ? (
                <ProcessingCard file={file} progress={progress} label="Membuka kunci dokumen..." onCancel={cancel} />
              ) : (
                <Button icon={LockOpen} onClick={handleUnlock}>
                  Buka kunci PDF
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
