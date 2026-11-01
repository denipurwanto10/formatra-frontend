import { PDFDocument } from "@cantoo/pdf-lib";

/**
 * Crops every page by a margin, expressed as a percentage (0-49) of that
 * page's own width/height, measured in from each side.
 * @param {File} file
 * @param {{top:number, right:number, bottom:number, left:number}} marginsPct
 * @param {"all"|number[]} pageIndices
 */
export async function cropPdf(file, marginsPct, pageIndices = "all", onProgress) {
  const bytes = await file.arrayBuffer();
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const pages = doc.getPages();
  const targets = pageIndices === "all" ? pages.map((_, i) => i) : pageIndices;

  targets.forEach((idx, i) => {
    const page = pages[idx];
    if (!page) return;
    const { width, height } = page.getSize();
    const top = (marginsPct.top / 100) * height;
    const bottom = (marginsPct.bottom / 100) * height;
    const left = (marginsPct.left / 100) * width;
    const right = (marginsPct.right / 100) * width;

    const newWidth = Math.max(20, width - left - right);
    const newHeight = Math.max(20, height - top - bottom);
    page.setCropBox(left, bottom, newWidth, newHeight);
    onProgress?.(Math.round(((i + 1) / targets.length) * 90));
  });

  const outBytes = await doc.save();
  onProgress?.(100);
  return new Blob([outBytes], { type: "application/pdf" });
}
