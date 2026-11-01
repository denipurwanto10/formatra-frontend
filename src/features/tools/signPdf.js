import { PDFDocument } from "@cantoo/pdf-lib";

function dataUrlToBytes(dataUrl) {
  const base64 = dataUrl.split(",")[1] || "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Stamps a hand-drawn signature (PNG data URL) onto one page, or every page,
 * of a PDF at a position given as a fraction of the page size.
 * @param {File} file
 * @param {object} opts
 * @param {number} opts.pageIndex 0-based target page (ignored if allPages)
 * @param {string} opts.image PNG data URL of the signature
 * @param {number} opts.xPct left offset, 0-1 of page width
 * @param {number} opts.yPct top offset, 0-1 of page height
 * @param {number} opts.wPct width, 0-1 of page width
 * @param {number} opts.hPct height, 0-1 of page height
 * @param {boolean} opts.allPages
 */
export async function signPdf(file, opts, onProgress) {
  const { pageIndex, image, xPct, yPct, wPct, hPct, allPages = false } = opts;

  const bytes = await file.arrayBuffer();
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const pngBytes = dataUrlToBytes(image);
  const embedded = await doc.embedPng(pngBytes);
  const pages = doc.getPages();
  const targets = allPages ? pages.map((_, i) => i) : [pageIndex];

  targets.forEach((idx, n) => {
    const page = pages[idx];
    if (!page) return;
    const { width, height } = page.getSize();
    const w = wPct * width;
    const h = hPct * height;
    const x = xPct * width;
    const y = height - yPct * height - h;
    page.drawImage(embedded, { x, y, width: w, height: h });
    onProgress?.(Math.round(((n + 1) / targets.length) * 90));
  });

  const outBytes = await doc.save();
  onProgress?.(100);
  return new Blob([outBytes], { type: "application/pdf" });
}
