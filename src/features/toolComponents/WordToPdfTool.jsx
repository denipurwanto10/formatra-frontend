import SimpleConvertTool from "../../components/tool/SimpleConvertTool";
import { TOOLS } from "../../lib/toolsMeta";
import { wordToPdf } from "../tools/wordToPdf";
import { replaceExtension } from "../../utils/download";
import { useToast } from "../../context/ToastContext";

export default function WordToPdfTool() {
  const toast = useToast();

  return (
    <SimpleConvertTool
      batch
      tool={TOOLS["word-to-pdf"]}
      convert={async (file, onProgress) => {
        const { blob, warnings } = await wordToPdf(file, onProgress);
        // Surface fidelity warnings (e.g. "simplified fallback mode used")
        // instead of silently dropping them — the user should know when the
        // result may not match the original layout 1:1.
        warnings?.forEach((w) => toast.warning("Tata letak mungkin tidak 100% sama", w.message || w));
        return blob;
      }}
      outputName={(file) => replaceExtension(file.name, "pdf")}
      actionLabel="Konversi ke PDF"
      successMessage="Dokumen Word berhasil dikonversi ke PDF"
    />
  );
}
