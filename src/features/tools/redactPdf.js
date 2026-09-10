import { PDFDocument } from "@cantoo/pdf-lib";
import { loadPdfDocument, renderPageToCanvas } from "../../lib/pdfjs";

const RENDER_SCALE = 2; // ~144dpi — good balance of legibility vs. output size

function canvasToJpegBlob(canvas, quality = 0.85) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Gagal merender halaman"))),
      "image/jpeg",
      quality
    );
  });
}

/**
 * Permanently redacts a PDF: paints solid black boxes over the chosen areas,
 * then rebuilds every page as a flattened raster image. Because the output
 * page is an image (not the original vector/text content with a shape drawn
 * on top), anything under a box is actually gone from the file, not just
 * visually hidden.
 * @param {File} file
 * @param {Record<number, Array<{xPct:number,yPct:number,wPct:number,hPct:number}>>} boxesByPage
 *   keyed by 0-based page index
 */
export async function redactPdf(file, boxesByPage, onProgress) {
  const srcDoc = await loadPdfDocument(file);
  const outDoc = await PDFDocument.create();
  const total = srcDoc.numPages;

  for (let i = 1; i <= total; i += 1) {
    const pageIndex = i - 1;
    // eslint-disable-next-line no-await-in-loop
    const { canvas } = await renderPageToCanvas(srcDoc, i, RENDER_SCALE);
    const ctx = canvas.getContext("2d");
    const boxes = boxesByPage[pageIndex] || [];
    ctx.fillStyle = "#000000";
    boxes.forEach((b) => {
      ctx.fillRect(b.xPct * canvas.width, b.yPct * canvas.height, b.wPct * canvas.width, b.hPct * canvas.height);
    });

    // eslint-disable-next-line no-await-in-loop
    const page = await srcDoc.getPage(i);
    const { width, height } = page.getViewport({ scale: 1 });

    // eslint-disable-next-line no-await-in-loop
    const jpegBlob = await canvasToJpegBlob(canvas);
    // eslint-disable-next-line no-await-in-loop
    const jpegBytes = await jpegBlob.arrayBuffer();
    // eslint-disable-next-line no-await-in-loop
    const image = await outDoc.embedJpg(jpegBytes);

    const outPage = outDoc.addPage([width, height]);
    outPage.drawImage(image, { x: 0, y: 0, width, height });

    onProgress?.(Math.round((i / total) * 95));
  }

  const outBytes = await outDoc.save();
  onProgress?.(100);
  return new Blob([outBytes], { type: "application/pdf" });
}
