import { createWorker } from "tesseract.js";
import { PDFDocument, StandardFonts, rgb } from "@cantoo/pdf-lib";
import { loadPdfDocument, renderPageToCanvas } from "../../lib/pdfjs";
import { preprocessScanCanvas } from "./imagePreprocess";

const OCR_SCALE = 2; // render PDF pages at 2x for sharper OCR input

function isPdfFile(file) {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

async function loadImageAsCanvas(file) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d").drawImage(bitmap, 0, 0);
  bitmap.close?.();
  return canvas;
}

async function collectPages(file) {
  if (isPdfFile(file)) {
    // A PDF page (even a scanned one embedded as an image) is left exactly
    // as rendered — deskew/crop/grayscale-enhance are for raw camera
    // photos; running them here too could needlessly discolor an already
    // straight, already-color digital PDF page.
    const pdfDoc = await loadPdfDocument(file);
    const total = pdfDoc.numPages;
    const pages = [];
    for (let i = 1; i <= total; i += 1) {
      const { canvas } = await renderPageToCanvas(pdfDoc, i, OCR_SCALE);
      // Points = pixels / OCR_SCALE, since renderPageToCanvas rasterized at OCR_SCALE.
      pages.push({ canvas, widthPt: canvas.width / OCR_SCALE, heightPt: canvas.height / OCR_SCALE });
    }
    return pages;
  }
  // A standalone image upload is treated as a scanned/photographed
  // document: straighten it, crop out background around the page, and
  // normalize contrast before OCR — this is also what most improves
  // recognition accuracy on a crooked or dim phone photo.
  const rawCanvas = await loadImageAsCanvas(file);
  const canvas = preprocessScanCanvas(rawCanvas);
  // Images have no inherent point size; 1px = 1pt, matching the rest of the app's image tools.
  return [{ canvas, widthPt: canvas.width, heightPt: canvas.height }];
}

/**
 * Run OCR on a PDF or image file and produce a "sandwich" PDF: the original
 * page rendered as a background image, with recognized words drawn as
 * invisible (opacity 0) selectable text on top — so the result looks
 * identical to the source but becomes searchable/copyable.
 *
 * @param {File} file PDF or image (jpg/png)
 * @param {{languages?: string[]}} options tesseract language codes, e.g. ["ind","eng"]
 * @param {(info:{page:number, total:number, progress:number}) => void} onProgress
 */
export async function ocrToSearchablePdf(file, { languages = ["ind", "eng"] } = {}, onProgress) {
  const pages = await collectPages(file);
  const total = pages.length;

  const outDoc = await PDFDocument.create();
  const font = await outDoc.embedFont(StandardFonts.Helvetica);

  const worker = await createWorker(languages, 1, {
    logger: (m) => {
      if (m.status === "recognizing text" && typeof m.progress === "number") {
        onProgress?.({ page: worker._currentPage || 1, total, progress: m.progress });
      }
    },
  });

  try {
    let fullText = "";
    for (let i = 0; i < total; i += 1) {
      worker._currentPage = i + 1;
      const { canvas, widthPt, heightPt } = pages[i];
      const scaleX = widthPt / canvas.width;
      const scaleY = heightPt / canvas.height;

      // eslint-disable-next-line no-await-in-loop
      const { data } = await worker.recognize(canvas);
      fullText += `${data.text}\n`;

      const jpegBytes = await (await fetch(canvas.toDataURL("image/jpeg", 0.85))).arrayBuffer();
      // eslint-disable-next-line no-await-in-loop
      const bgImage = await outDoc.embedJpg(jpegBytes);
      const page = outDoc.addPage([widthPt, heightPt]);
      page.drawImage(bgImage, { x: 0, y: 0, width: widthPt, height: heightPt });

      (data.words || []).forEach((word) => {
        const text = word.text?.trim();
        if (!text) return;
        const { x0, y0, x1, y1 } = word.bbox;
        const wPt = (x1 - x0) * scaleX;
        const hPt = (y1 - y0) * scaleY;
        if (wPt <= 0 || hPt <= 0) return;
        // Size the invisible run so its rendered width matches the word's
        // pixel width, keeping the text layer aligned with what's drawn.
        const naturalWidth = font.widthOfTextAtSize(text, hPt) || 1;
        const fitSize = hPt * (wPt / naturalWidth);
        page.drawText(text, {
          x: x0 * scaleX,
          y: heightPt - y1 * scaleY,
          size: Math.max(1, Math.min(fitSize, hPt * 2)),
          font,
          color: rgb(0, 0, 0),
          opacity: 0,
        });
      });

      onProgress?.({ page: i + 1, total, progress: 1 });
    }

    const outBytes = await outDoc.save();
    return { blob: new Blob([outBytes], { type: "application/pdf" }), text: fullText.trim() };
  } finally {
    await worker.terminate();
  }
}
