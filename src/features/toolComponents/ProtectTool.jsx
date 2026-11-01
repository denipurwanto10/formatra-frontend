import { useState } from "react";
import { Lock, Eye, EyeOff } from "lucide-react";
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
import { protectPdf } from "../tools/protectPdf";

export default function ProtectTool() {
  const tool = TOOLS["protect-pdf"];
  const [file, setFile] = useState(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [allowPrinting, setAllowPrinting] = useState(true);
  const [allowCopying, setAllowCopying] = useState(true);
  const [showPw, setShowPw] = useState(false);
  const { status, progress, result, error, run, reset, cancel } = useToolProcess(tool);
  const toast = useToast();

  const handleReset = () => {
    reset();
    setFile(null);
    setPassword("");
    setConfirm("");
  };

  const handleApply = async () => {
    if (password.length < 4) {
      toast.warning("Kata sandi terlalu pendek", "Gunakan minimal 4 karakter.");
      return;
    }
    if (password !== confirm) {
      toast.warning("Konfirmasi kata sandi tidak cocok");
      return;
    }
    try {
      const blob = await run((onProgress) =>
        protectPdf(
          file,
          {
            userPassword: password,
            permissions: {
              printing: allowPrinting ? "highResolution" : false,
              copying: allowCopying,
              modifying: false,
              annotating: true,
              fillingForms: true,
              contentAccessibility: true,
              documentAssembly: false,
            },
          },
          onProgress
        ),
        file.name
      );
      toast.success("PDF berhasil dikunci", "Simpan kata sandi baik-baik — tidak bisa dipulihkan jika hilang.");
      return blob;
    } catch {
      toast.error("Gagal mengunci PDF");
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 lg:px-8">
      <ToolPageHeader tool={tool} />

      {status === "done" && result && (
        <ResultCard files={[{ name: "dokumen-terkunci.pdf", blob: result }]} onReset={handleReset} />
      )}
      {status === "error" && <ErrorState description={error} onRetry={handleReset} />}

      {(status === "idle" || status === "processing") && (
        <div className="flex flex-col gap-4">
          {!file ? (
            <Dropzone accept={tool.accept} onFiles={(fs) => setFile(fs[0])} />
          ) : (
            <>
              {status !== "processing" && <FileListItem file={file} onRemove={handleReset} />}

              <div className="rounded-2xl border-hair bg-surface-2/50 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[12.5px] font-medium text-ink">Kekuatan kata sandi</p>
                  <span className={`text-[11px] font-semibold ${password.length >= 12 ? "text-[var(--success)]" : password.length >= 8 ? "text-[var(--warning)]" : "text-muted"}`}>
                    {password.length >= 12 ? "Kuat" : password.length >= 8 ? "Cukup" : password ? "Pendek" : "Belum diisi"}
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-base">
                  <div className="h-full rounded-full bg-accent transition-all duration-200" style={{ width: `${Math.min(100, password.length * 8.5)}%` }} />
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-muted">Untuk dokumen penting, gunakan frasa sandi yang panjang dan unik.</p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Kata sandi">
                  <div className="relative">
                    <input
                      type={showPw ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-md border-hair bg-base px-3 py-2 pr-9 text-[13px] text-ink"
                      placeholder="Minimal 4 karakter"
                    />
                    <button
                      onClick={() => setShowPw((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                      type="button"
                    >
                      {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </Field>
                <Field label="Konfirmasi kata sandi">
                  <input
                    type={showPw ? "text" : "password"}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="w-full rounded-md border-hair bg-base px-3 py-2 text-[13px] text-ink"
                  />
                </Field>
              </div>

              <div className="flex flex-col gap-2 rounded-md border-hair p-3">
                <p className="text-[12.5px] font-medium text-muted">Izin dokumen</p>
                <Checkbox checked={allowPrinting} onChange={setAllowPrinting} label="Izinkan pencetakan" />
                <Checkbox checked={allowCopying} onChange={setAllowCopying} label="Izinkan salin teks/gambar" />
              </div>

              {status === "processing" ? (
                <ProcessingCard file={file} progress={progress} label="Mengenkripsi dokumen..." onCancel={cancel} />
              ) : (
                <Button icon={Lock} onClick={handleApply}>
                  Kunci PDF dengan kata sandi
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

function Checkbox({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-2 text-[13px] text-ink">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-3.5 accent-[var(--accent)]"
      />
      {label}
    </label>
  );
}
