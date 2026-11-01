import SimpleConvertTool from "../../components/tool/SimpleConvertTool";
import { TOOLS } from "../../lib/toolsMeta";
import { pdfToWord } from "../tools/pdfToWord";
import { replaceExtension } from "../../utils/download";

export default function PdfToWordTool() {
  return (
    <SimpleConvertTool
      batch
      tool={TOOLS["pdf-to-word"]}
      convert={(file, onProgress) => pdfToWord(file, onProgress)}
      outputName={(file) => replaceExtension(file.name, "docx")}
      actionLabel="Konversi ke Word"
      successMessage="PDF berhasil dikonversi ke Word"
    />
  );
}
