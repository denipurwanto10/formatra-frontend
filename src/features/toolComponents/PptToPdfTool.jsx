import SimpleConvertTool from "../../components/tool/SimpleConvertTool";
import { TOOLS } from "../../lib/toolsMeta";
import { pptToPdf } from "../tools/pptToPdf";
import { replaceExtension } from "../../utils/download";
import { useToast } from "../../context/ToastContext";

export default function PptToPdfTool() {
  const toast = useToast();

  return (
    <SimpleConvertTool
      batch
      tool={TOOLS["ppt-to-pdf"]}
      convert={async (file, onProgress) => {
        const { blob, warnings } = await pptToPdf(file, onProgress);
        warnings?.forEach((w) => toast.warning("Beberapa elemen dilewati", w));
        return blob;
      }}
      outputName={(file) => replaceExtension(file.name, "pdf")}
      actionLabel="Konversi ke PDF"
      successMessage="Slide berhasil dikonversi ke PDF"
    />
  );
}
