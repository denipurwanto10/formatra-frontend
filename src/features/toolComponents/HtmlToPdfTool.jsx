import { useState } from "react";
import { FileOutput } from "lucide-react";
import ToolPageHeader from "../../components/tool/ToolPageHeader";
import ResultCard from "../../components/tool/ResultCard";
import Button from "../../components/ui/Button";
import ProgressBar from "../../components/ui/ProgressBar";
import ErrorState from "../../components/ui/ErrorState";
import { TOOLS } from "../../lib/toolsMeta";
import { useToolProcess } from "../../hooks/useToolProcess";
import { useToast } from "../../context/ToastContext";
import { htmlToPdfBlob } from "../tools/htmlToPdf";

const DEFAULT_HTML = `<h1>Judul Dokumen</h1>
<p>Tulis atau tempel HTML di sini. Elemen seperti heading, paragraf, list,
dan tabel akan dirender sesuai gaya CSS bawaan browser.</p>
<ul>
  <li>Poin pertama</li>
  <li>Poin kedua</li>
</ul>`;

export default function HtmlToPdfTool() {
  const tool = TOOLS["html-to-pdf"];
  const [html, setHtml] = useState(DEFAULT_HTML);
  const [pageSize, setPageSize] = useState("a4");
  const [orientation, setOrientation] = useState("portrait");
  const [marginMm, setMarginMm] = useState(18);
  const { status, progress, result, error, run, reset } = useToolProcess(tool);
  const toast = useToast();

  const handleGenerate = async () => {
    if (!html.trim()) {
      toast.error("HTML kosong", "Tulis atau tempel HTML terlebih dahulu.");
      return;
    }
    try {
      await run(
        (onProgress) => htmlToPdfBlob(html, onProgress, { pageSize, orientation, marginMm }),
        "dokumen.pdf"
      );
      toast.success("PDF berhasil dibuat");
    } catch {
      toast.error("Gagal membuat PDF");
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 lg:px-8">
      <ToolPageHeader tool={tool} />

      {status === "done" && result && (
        <ResultCard files={[{ name: "dokumen.pdf", blob: result }]} onReset={reset} />
      )}
      {status === "error" && <ErrorState description={error} onRetry={reset} />}

      {(status === "idle" || status === "processing") && (
        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-[12.5px] font-medium text-ink">HTML</label>
            <textarea
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              rows={12}
              spellCheck={false}
              className="w-full resize-y rounded-md border-hair bg-surface px-3 py-2.5 font-mono text-[12.5px] leading-relaxed text-ink outline-none focus:border-accent"
              placeholder="<h1>Halo dunia</h1>"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Ukuran halaman">
              <select
                value={pageSize}
                onChange={(e) => setPageSize(e.target.value)}
                className="h-9 w-full rounded-md border-hair bg-surface px-2.5 text-[13px] text-ink outline-none focus:border-accent"
              >
                <option value="a4">A4</option>
                <option value="letter">Letter</option>
                <option value="legal">Legal</option>
              </select>
            </Field>
            <Field label="Orientasi">
              <select
                value={orientation}
                onChange={(e) => setOrientation(e.target.value)}
                className="h-9 w-full rounded-md border-hair bg-surface px-2.5 text-[13px] text-ink outline-none focus:border-accent"
              >
                <option value="portrait">Potret</option>
                <option value="landscape">Lanskap</option>
              </select>
            </Field>
            <Field label="Margin (mm)">
              <input
                type="number"
                min={0}
                max={50}
                value={marginMm}
                onChange={(e) => setMarginMm(Math.max(0, Math.min(50, Number(e.target.value) || 0)))}
                className="h-9 w-full rounded-md border-hair bg-surface px-2.5 text-[13px] text-ink outline-none focus:border-accent"
              />
            </Field>
          </div>

          <div>
            <p className="mb-1.5 text-[12.5px] font-medium text-ink">Pratinjau</p>
            <div className="max-h-72 overflow-auto rounded-md border-hair bg-white p-4">
              {/* eslint-disable-next-line react/no-danger -- user-authored HTML rendered locally for their own preview, never sent anywhere */}
              <div className="prose-preview text-[13px] text-black" dangerouslySetInnerHTML={{ __html: html }} />
            </div>
          </div>

          {status === "processing" ? (
            <ProgressBar value={progress} label="Membuat PDF..." />
          ) : (
            <Button icon={FileOutput} onClick={handleGenerate}>
              Buat PDF
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-[12.5px] font-medium text-ink">{label}</label>
      {children}
    </div>
  );
}
