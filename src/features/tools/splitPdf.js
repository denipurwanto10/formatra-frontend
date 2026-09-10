import { PDFDocument } from "@cantoo/pdf-lib";
import JSZip from "jszip";

/**
 * @param {File} file
 * @param {{from:number, to:number}[]} ranges 1-indexed inclusive page ranges
 */
export async function splitPdfByRanges(file, ranges, onProgress) {
  const bytes = await file.arrayBuffer();
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const total = src.getPageCount();
  const results = [];

  for (let i = 0; i < ranges.length; i += 1) {
    const { from, to } = ranges[i];
    const clampedFrom = Math.max(1, from);
    const clampedTo = Math.min(total, to);
    const indices = [];
    for (let p = clampedFrom; p <= clampedTo; p += 1) indices.push(p - 1);

    const out = await PDFDocument.create();
    const pages = await out.copyPages(src, indices);
    pages.forEach((p) => out.addPage(p));
    const outBytes = await out.save();

    results.push({
      name: `${baseName(file.name)}-bagian-${i + 1}.pdf`,
      blob: new Blob([outBytes], { type: "application/pdf" }),
    });
    onProgress?.(Math.round(((i + 1) / ranges.length) * 100));
  }

  return results;
}

/** Split every page of the PDF into its own single-page file. */
export async function splitPdfAllPages(file, onProgress) {
  const bytes = await file.arrayBuffer();
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const total = src.getPageCount();
  const ranges = Array.from({ length: total }, (_, i) => ({ from: i + 1, to: i + 1 }));
  return splitPdfByRanges(file, ranges, onProgress);
}

export async function zipResults(results) {
  const zip = new JSZip();
  results.forEach((r) => zip.file(r.name, r.blob));
  return zip.generateAsync({ type: "blob" });
}

function baseName(filename) {
  return filename.replace(/\.[^/.]+$/, "");
}
