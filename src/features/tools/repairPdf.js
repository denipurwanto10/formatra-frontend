import { PDFDocument } from "@cantoo/pdf-lib";

/**
 * Attempts to repair a damaged/malformed PDF by parsing it as leniently as
 * possible, then rebuilding a brand-new document page by page — this drops
 * broken cross-reference tables, orphaned objects, and incremental-update
 * chains, and skips any individual page that still can't be read.
 *
 * @param {File} file
 * @returns {Promise<{blob: Blob, recovered: number, total: number, skipped: number[]}>}
 */
export async function repairPdf(file, onProgress) {
  const bytes = await file.arrayBuffer();

  let src;
  try {
    src = await PDFDocument.load(bytes, {
      ignoreEncryption: true,
      throwOnInvalidObject: false,
      capNumbers: true,
      updateMetadata: false,
      parseSpeed: 100,
    });
  } catch {
    throw new Error(
      "File tidak bisa dibaca sama sekali — kemungkinan bukan PDF atau rusak parah."
    );
  }
  onProgress?.(20);

  const total = src.getPageCount();
  if (total === 0) {
    throw new Error("PDF tidak berisi halaman yang bisa dipulihkan.");
  }

  const out = await PDFDocument.create();
  const skipped = [];

  for (let i = 0; i < total; i += 1) {
    try {
      const [copied] = await out.copyPages(src, [i]);
      out.addPage(copied);
    } catch {
      skipped.push(i + 1);
    }
    onProgress?.(20 + Math.round(((i + 1) / total) * 65));
  }

  if (out.getPageCount() === 0) {
    throw new Error("Tidak ada halaman yang berhasil dipulihkan dari file ini.");
  }

  // Try to carry over whatever metadata is still intact; ignore failures.
  try {
    const title = src.getTitle();
    if (title) out.setTitle(title);
    const author = src.getAuthor();
    if (author) out.setAuthor(author);
  } catch {
    /* ignore */
  }
  out.setProducer("Formatra (Repair)");

  const outBytes = await out.save();
  onProgress?.(100);

  return {
    blob: new Blob([outBytes], { type: "application/pdf" }),
    recovered: out.getPageCount(),
    total,
    skipped,
  };
}
