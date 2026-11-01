import SimpleConvertTool from "../../components/tool/SimpleConvertTool";
import { TOOLS } from "../../lib/toolsMeta";
import { pdfToPowerpoint } from "../tools/pdfToPowerpoint";
import { replaceExtension } from "../../utils/download";

export default function PdfToPowerpointTool() {
  return (
    <SimpleConvertTool
      batch
      tool={TOOLS["pdf-to-powerpoint"]}
      convert={(file, onProgress) => pdfToPowerpoint(file, onProgress)}
      outputName={(file) => replaceExtension(file.name, "pptx")}
      actionLabel="Konversi ke PowerPoint"
      successMessage="Setiap halaman PDF berhasil menjadi satu slide PowerPoint"
    />
  );
}
