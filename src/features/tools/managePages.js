import { PDFDocument } from "@cantoo/pdf-lib";

function baseName(filename) {
  return filename.replace(/\.[^/.]+$/, "");
}

/**
 * @param {File} file
 * @param {number[]} pageIndices 0-indexed pages to remove
 */
export async function deletePages(file, pageIndices, onProgress) {
  const bytes = await file.arrayBuffer();
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const total = doc.getPageCount();
  const toRemove = new Set(pageIndices);

  if (toRemove.size >= total) {
    throw new Error("Tidak bisa menghapus semua halaman — PDF harus punya minimal 1 halaman.");
  }

  onProgress?.(20);
  // Remove from the highest index down so earlier indices stay valid.
  Array.from(toRemove)
    .sort((a, b) => b - a)
    .forEach((idx) => doc.removePage(idx));
  onProgress?.(80);

  const outBytes = await doc.save();
  onProgress?.(100);
  return new Blob([outBytes], { type: "application/pdf" });
}

/**
 * @param {File} file
 * @param {number[]} pageIndices 0-indexed pages to keep, in the given order
 */
export async function extractPages(file, pageIndices, onProgress) {
  if (pageIndices.length === 0) {
    throw new Error("Pilih minimal satu halaman untuk diekstrak.");
  }
  const bytes = await file.arrayBuffer();
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  onProgress?.(20);

  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, pageIndices);
  pages.forEach((p) => out.addPage(p));
  onProgress?.(80);

  const outBytes = await out.save();
  onProgress?.(100);
  return new Blob([outBytes], { type: "application/pdf" });
}

export function pagesOutputName(filename, mode) {
  return `${baseName(filename)}-${mode === "delete" ? "terhapus" : "diekstrak"}.pdf`;
}
