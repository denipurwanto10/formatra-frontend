import { PDFDocument, degrees } from "@cantoo/pdf-lib";

/**
 * @param {File} file
 * @param {Record<number, number>} pageAngles map of 0-indexed page index ->
 *   additional rotation in degrees (e.g. 90, 180, 270) to apply on top of
 *   that page's current rotation. Pages not present in the map, or present
 *   with a multiple of 360, are left untouched.
 */
export async function rotatePdf(file, pageAngles, onProgress) {
  const bytes = await file.arrayBuffer();
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const pages = doc.getPages();
  const entries = Object.entries(pageAngles || {}).filter(([, delta]) => delta % 360 !== 0);

  entries.forEach(([idxStr, delta], i) => {
    const page = pages[Number(idxStr)];
    if (!page) return;
    const current = page.getRotation().angle;
    page.setRotation(degrees((current + delta + 360) % 360));
    onProgress?.(Math.round(((i + 1) / entries.length) * 90));
  });

  const outBytes = await doc.save();
  onProgress?.(100);
  return new Blob([outBytes], { type: "application/pdf" });
}
