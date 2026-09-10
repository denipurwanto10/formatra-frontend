import { PDFDocument, degrees } from "@cantoo/pdf-lib";

/**
 * @param {File} file
 * @param {number} angle 90 | 180 | 270 applied as a relative rotation
 * @param {number[] | "all"} pageIndices 0-indexed pages to rotate, or "all"
 */
export async function rotatePdf(file, angle, pageIndices = "all", onProgress) {
  const bytes = await file.arrayBuffer();
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const pages = doc.getPages();
  const targets = pageIndices === "all" ? pages.map((_, i) => i) : pageIndices;

  targets.forEach((idx, i) => {
    const page = pages[idx];
    if (!page) return;
    const current = page.getRotation().angle;
    page.setRotation(degrees((current + angle + 360) % 360));
    onProgress?.(Math.round(((i + 1) / targets.length) * 90));
  });

  const outBytes = await doc.save();
  onProgress?.(100);
  return new Blob([outBytes], { type: "application/pdf" });
}
