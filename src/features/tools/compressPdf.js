import { PDFDocument } from "@cantoo/pdf-lib";
import { loadPdfDocument, renderPageToCanvas } from "../../lib/pdfjs";

/**
 * Lossless mode: re-serializes the PDF with compressed cross-reference/object
 * streams. Safe, keeps text selectable, but savings are modest — real size
 * comes mostly from re-encoding embedded images, which this mode does not touch.
 */
async function compressLossless(file, onProgress) {
  const bytes = await file.arrayBuffer();
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  onProgress?.(50);
  const outBytes = await doc.save({ useObjectStreams: true });
  onProgress?.(100);
  return new Blob([outBytes], { type: "application/pdf" });
}

/**
 * Aggressive mode: rasterizes every page to a JPEG at the given DPI/quality and
 * rebuilds the PDF from those images. Shrinks file size a lot, especially for
 * scanned or image-heavy PDFs, but text stops being selectable/searchable.
 */
async function compressRasterize(file, { scale = 1.4, quality = 0.6 } = {}, onProgress) {
  const pdfDoc = await loadPdfDocument(file);
  const total = pdfDoc.numPages;
  const out = await PDFDocument.create();

  for (let i = 1; i <= total; i += 1) {
    const { canvas, viewport } = await renderPageToCanvas(pdfDoc, i, scale);
    const jpegDataUrl = canvas.toDataURL("image/jpeg", quality);
    const jpegBytes = await (await fetch(jpegDataUrl)).arrayBuffer();
    const image = await out.embedJpg(jpegBytes);

    // Keep the page's original point-size (viewport at scale 1) so the output
    // isn't physically larger than the source, only the pixel density changes.
    const pageWidthPt = viewport.width / scale;
    const pageHeightPt = viewport.height / scale;
    const page = out.addPage([pageWidthPt, pageHeightPt]);
    page.drawImage(image, { x: 0, y: 0, width: pageWidthPt, height: pageHeightPt });

    onProgress?.(Math.round((i / total) * 90));
  }

  const outBytes = await out.save();
  onProgress?.(100);
  return new Blob([outBytes], { type: "application/pdf" });
}

const RASTERIZE_PRESETS = {
  balanced: { scale: 1.8, quality: 0.75 },
  strong: { scale: 1.2, quality: 0.5 },
};

/**
 * @param {File} file
 * @param {"lossless"|"balanced"|"strong"} level
 */
export async function compressPdf(file, level = "lossless", onProgress) {
  if (level === "balanced" || level === "strong") {
    return compressRasterize(file, RASTERIZE_PRESETS[level], onProgress);
  }
  return compressLossless(file, onProgress);
}
