import { useState } from "react";
import { Landmark } from "lucide-react";
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
import { pdfToPdfA, PDFA_CONFORMANCE_LEVELS } from "../tools/pdfToPdfA";
import { withSuffix } from "../../utils/download";

export default function PdfToPdfATool() {
  const tool = TOOLS["pdf-to-pdfa"];
  const [file, setFile] = useState(null);
  const [conformance, setConformance] = useState("2B");

  const convert = (f, onProgress) => pdfToPdfA(f, { conformance }, onProgress);

  const { status, progress, result, error, run, reset, cancel } = useToolProcess(tool);
  const batchProcess = useBatchProcess(convert, tool);
  const toast = useToast();

  // NOTE: `withSuffix` keeps the original ".pdf" extension, so strip it
  // first — otherwise "doc.pdf" would come out as "doc-pdfa-2b.pdf.pdf".
  const outputName = (f) => withSuffix(f.name.replace(/\.pdf$/i, ""), `pdfa-${conformance.toLowerCase()}`) + ".pdf";

  const handleReset = () => {
    reset();
    setFile(null);
    batchProcess.reset();
  };

  const handleConvert = async () => {
    try {
      const blob = await run((onProgress) => convert(file, onProgress), file.name);
      toast.success("PDF berhasil dikonversi ke PDF/A", "Idealnya validasi lagi dengan veraPDF sebelum disetor ke instansi.");
      return blob;
    } catch (e) {
      toast.error("Gagal mengonversi ke PDF/A", e?.message);
    }
  };

  const handleFiles = (files) => {
    if (files.length > 1) {
      batchProcess.setFiles(files);
    } else {
      setFile(files[0]);
    }
  };

  const isBatchMode = batchProcess.items.length > 0;

  const levelPicker = (
    <div className="flex flex-col gap-2">
      {PDFA_CONFORMANCE_LEVELS.map((lvl) => (
        <button
          key={lvl.id}
          onClick={() => setConformance(lvl.id)}
          className={`flex flex-col gap-1 rounded-md border-hair p-3 text-left transition-colors ${
            conformance === lvl.id ? "border-accent bg-surface-2" : "hover:bg-surface-2/60"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className={`size-3.5 shrink-0 rounded-full border-2 ${conformance === lvl.id ? "border-accent bg-accent" : "border-hair"}`} />
            <span className="text-[13.5px] font-medium text-ink">{lvl.title}</span>
          </div>
          <p className="pl-[22px] text-[12.5px] text-muted">{lvl.description}</p>
        </button>
      ))}
    </div>
  );

  if (isBatchMode) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-8 lg:px-8">
        <ToolPageHeader tool={tool} />
        <div className="mb-4">{levelPicker}</div>
        <BatchResultList
          items={batchProcess.items}
          outputName={outputName}
          zipName="pdf-arsip-pdfa.zip"
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

      {status === "done" && result && (
        <ResultCard files={[{ name: outputName(file), blob: result }]} onReset={handleReset} />
      )}
      {status === "error" && <ErrorState description={error} onRetry={handleReset} />}

      {(status === "idle" || status === "processing") && (
        <div className="flex flex-col gap-4">
          {!file ? (
            <Dropzone
              accept={tool.accept}
              multiple
              onFiles={handleFiles}
              hint="Bisa pilih beberapa file sekaligus untuk diproses satu per satu"
            />
          ) : (
            <>
              {status !== "processing" && <FileListItem file={file} onRemove={handleReset} />}
              {levelPicker}
              <p className="text-[12px] text-muted">
                Catatan arsip: konversi ini melakukan langkah struktural PDF/A (ID dokumen, profil warna sRGB, metadata XMP).
                PDF terenkripsi, font yang tidak di-embed, atau transparansi (untuk PDF/A-1) tetap bisa menggagalkan validasi —
                cek hasilnya dengan veraPDF bila instansi mensyaratkan kepatuhan penuh.
              </p>
              {status === "processing" ? (
                <ProcessingCard file={file} progress={progress} label="Mengonversi ke PDF/A..." onCancel={cancel} />
              ) : (
                <Button icon={Landmark} onClick={handleConvert}>
                  Konversi ke PDF/A
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
