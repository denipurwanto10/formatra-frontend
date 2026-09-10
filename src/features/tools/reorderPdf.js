import { PDFDocument } from "@cantoo/pdf-lib";

/**
 * @param {File} file
 * @param {number[]} newOrder 0-indexed original page indices in their new order
 */
export async function reorderPdf(file, newOrder, onProgress) {
  const bytes = await file.arrayBuffer();
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, newOrder);
  pages.forEach((p, i) => {
    out.addPage(p);
    onProgress?.(Math.round(((i + 1) / newOrder.length) * 90));
  });
  const outBytes = await out.save();
  onProgress?.(100);
  return new Blob([outBytes], { type: "application/pdf" });
}

/** Delete a set of pages (0-indexed) from a PDF. */
export async function deletePdfPages(file, indicesToDelete, onProgress) {
  const bytes = await file.arrayBuffer();
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const total = src.getPageCount();
  const keep = [];
  for (let i = 0; i < total; i += 1) {
    if (!indicesToDelete.includes(i)) keep.push(i);
  }
  return reorderPdf(file, keep, onProgress);
}
