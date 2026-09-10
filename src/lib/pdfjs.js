import * as pdfjsLib from "pdfjs-dist";
import PdfWorker from "pdfjs-dist/build/pdf.worker.mjs?worker";

pdfjsLib.GlobalWorkerOptions.workerPort = new PdfWorker();

export { pdfjsLib };

/**
 * Load a PDF document from an ArrayBuffer/File and return a pdfjs document proxy.
 */
export async function loadPdfDocument(source) {
  let data;
  if (source instanceof File || source instanceof Blob) {
    data = await source.arrayBuffer();
  } else {
    data = source;
  }
  // pdfjs detaches the buffer, so always hand it a fresh copy of the bytes
  const task = pdfjsLib.getDocument({ data: data.slice(0) });
  return task.promise;
}

/**
 * Render a single page of a pdfjs document to a canvas and return the canvas.
 */
export async function renderPageToCanvas(pdfDoc, pageNumber, scale = 1) {
  const page = await pdfDoc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d");
  await page.render({ canvasContext: ctx, viewport }).promise;
  return { canvas, viewport, page };
}
