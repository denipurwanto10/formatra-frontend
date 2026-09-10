import { lazy, Suspense } from "react";
import { useParams, Navigate } from "react-router-dom";
import { TOOLS } from "../lib/toolsMeta";
import Spinner from "../components/ui/Spinner";

const COMPONENTS = {
  "word-to-pdf": lazy(() => import("../features/toolComponents/WordToPdfTool")),
  "pdf-to-word": lazy(() => import("../features/toolComponents/PdfToWordTool")),
  "excel-to-pdf": lazy(() => import("../features/toolComponents/ExcelToPdfTool")),
  "ppt-to-pdf": lazy(() => import("../features/toolComponents/PptToPdfTool")),
  "image-to-pdf": lazy(() => import("../features/toolComponents/ImagesToPdfTool")),
  "pdf-to-image": lazy(() => import("../features/toolComponents/PdfToImagesTool")),
  "convert-image": lazy(() => import("../features/toolComponents/ImageConvertTool")),
  "html-to-pdf": lazy(() => import("../features/toolComponents/HtmlToPdfTool")),
  "merge-pdf": lazy(() => import("../features/toolComponents/MergeTool")),
  "split-pdf": lazy(() => import("../features/toolComponents/SplitTool")),
  "reorder-pdf": lazy(() => import("../features/toolComponents/ReorderTool")),
  "rotate-pdf": lazy(() => import("../features/toolComponents/RotateTool")),
  "compress-pdf": lazy(() => import("../features/toolComponents/CompressTool")),
  "watermark-pdf": lazy(() => import("../features/toolComponents/WatermarkTool")),
  "protect-pdf": lazy(() => import("../features/toolComponents/ProtectTool")),
  "pdf-editor": lazy(() => import("../features/editor/PdfEditorPage")),
  "unlock-pdf": lazy(() => import("../features/toolComponents/UnlockTool")),
  "page-numbers": lazy(() => import("../features/toolComponents/PageNumbersTool")),
  "manage-pages": lazy(() => import("../features/toolComponents/PageManagerTool")),
  "edit-metadata": lazy(() => import("../features/toolComponents/MetadataTool")),
  "crop-pdf": lazy(() => import("../features/toolComponents/CropTool")),
  "repair-pdf": lazy(() => import("../features/toolComponents/RepairTool")),
  "ocr-pdf": lazy(() => import("../features/toolComponents/OcrTool")),
  "pdf-to-txt": lazy(() => import("../features/toolComponents/PdfToTxtTool")),
  "pdf-to-markdown": lazy(() => import("../features/toolComponents/PdfToMarkdownTool")),
  "scan-to-pdf": lazy(() => import("../features/toolComponents/ScanTool")),
  "sign-pdf": lazy(() => import("../features/toolComponents/SignTool")),
  "fill-form": lazy(() => import("../features/toolComponents/FormTool")),
  "redact-pdf": lazy(() => import("../features/toolComponents/RedactTool")),
  "compare-pdf": lazy(() => import("../features/toolComponents/CompareTool")),
  "compress-video": lazy(() => import("../features/toolComponents/CompressVideoTool")),
  "edit-video": lazy(() => import("../features/toolComponents/EditVideoTool")),
  "crop-video": lazy(() => import("../features/toolComponents/CropVideoTool")),
  "video-speed": lazy(() => import("../features/toolComponents/VideoSpeedTool")),
  "watermark-video": lazy(() => import("../features/toolComponents/WatermarkVideoTool")),
  "video-to-gif": lazy(() => import("../features/toolComponents/VideoToGifTool")),
  "extract-audio": lazy(() => import("../features/toolComponents/ExtractAudioTool")),
  "compress-audio": lazy(() => import("../features/toolComponents/CompressAudioTool")),
};

function PageFallback() {
  return (
    <div className="flex h-64 items-center justify-center">
      <Spinner />
    </div>
  );
}

export default function ToolPage() {
  const { toolId } = useParams();
  const tool = TOOLS[toolId];
  const Component = COMPONENTS[toolId];

  if (!tool || !Component) {
    return <Navigate to="/app" replace />;
  }

  return (
    <Suspense fallback={<PageFallback />}>
      <Component />
    </Suspense>
  );
}
