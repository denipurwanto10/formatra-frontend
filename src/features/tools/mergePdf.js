import { PDFDocument } from "@cantoo/pdf-lib";

/**
 * Merge an ordered list of PDF Files into a single PDF Blob.
 * @param {File[]} files
 * @param {(progress:number)=>void} onProgress 0-100
 */
export async function mergePdfs(files, onProgress) {
  const merged = await PDFDocument.create();

  for (let i = 0; i < files.length; i += 1) {
    const bytes = await files[i].arrayBuffer();
    const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const pages = await merged.copyPages(src, src.getPageIndices());
    pages.forEach((p) => merged.addPage(p));
    onProgress?.(Math.round(((i + 1) / files.length) * 90));
  }

  const bytes = await merged.save();
  onProgress?.(100);
  return new Blob([bytes], { type: "application/pdf" });
}
