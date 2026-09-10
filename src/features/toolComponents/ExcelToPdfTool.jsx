import SimpleConvertTool from "../../components/tool/SimpleConvertTool";
import { TOOLS } from "../../lib/toolsMeta";
import { excelToPdf } from "../tools/excelToPdf";
import { replaceExtension } from "../../utils/download";

export default function ExcelToPdfTool() {
  return (
    <SimpleConvertTool
      batch
      tool={TOOLS["excel-to-pdf"]}
      convert={(file, onProgress) => excelToPdf(file, onProgress)}
      outputName={(file) => replaceExtension(file.name, "pdf")}
      actionLabel="Konversi ke PDF"
      successMessage="Spreadsheet berhasil dikonversi ke PDF"
    />
  );
}
