import { PDFDocument } from "@cantoo/pdf-lib";

/**
 * Appends every page of `insertFile` onto the end of `originalFile`'s
 * underlying PDF bytes and returns the merged file plus the index range the
 * newly appended pages now occupy.
 *
 * Appending (rather than splicing bytes into the middle) means every
 * existing page keeps the exact `sourceIndex` it already had — the caller
 * decides where the new pages show up *visually* by where it splices their
 * page metas into the editor's `pages` array (see
 * useEditorStore.insertSourcePages), the same decoupling that already lets
 * drag-and-drop reordering work without touching the underlying PDF at all.
 */
export async function appendPdfPages(originalFile, insertFile) {
  const [origBytes, insertBytes] = await Promise.all([
    originalFile.arrayBuffer(),
    insertFile.arrayBuffer(),
  ]);
  const base = await PDFDocument.load(origBytes, { ignoreEncryption: true });
  const startIndex = base.getPageCount();
  const insertDoc = await PDFDocument.load(insertBytes, { ignoreEncryption: true });
  const indices = insertDoc.getPageIndices();
  if (indices.length === 0) {
    throw new Error("File PDF yang disisipkan tidak memiliki halaman.");
  }
  const copied = await base.copyPages(insertDoc, indices);
  copied.forEach((p) => base.addPage(p));
  const bytes = await base.save();
  const mergedFile = new File([bytes], originalFile.name, { type: "application/pdf" });
  return { mergedFile, startIndex, count: copied.length };
}
