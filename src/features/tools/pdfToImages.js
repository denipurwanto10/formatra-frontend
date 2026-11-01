import { loadPdfDocument, renderPageToCanvas } from "../../lib/pdfjs";
import { zipResults } from "./splitPdf";

/**
 * @param {File} file
 * @param {object} opts
 * @param {"png"|"jpg"} opts.format
 * @param {number} opts.scale render scale, ~2 = ~144dpi
 * @param {number} opts.quality jpg quality 0-1
 */
export async function pdfToImages(file, opts = {}, onProgress) {
  const { format = "png", scale = 2, quality = 0.92 } = opts;
  const pdfDoc = await loadPdfDocument(file);
  const total = pdfDoc.numPages;
  const results = [];
  const baseName = file.name.replace(/\.[^/.]+$/, "");

  for (let i = 1; i <= total; i += 1) {
    const { canvas } = await renderPageToCanvas(pdfDoc, i, scale);
    const mime = format === "jpg" ? "image/jpeg" : "image/png";
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, mime, format === "jpg" ? quality : undefined)
    );
    results.push({
      name: `${baseName}-hal-${String(i).padStart(2, "0")}.${format === "jpg" ? "jpg" : "png"}`,
      blob,
    });
    onProgress?.(Math.round((i / total) * 90));
  }

  onProgress?.(100);

  if (results.length === 1) {
    return { single: results[0] };
  }
  const zip = await zipResults(results);
  return { zip, count: results.length };
}
