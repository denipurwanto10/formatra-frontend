import { PDFDocument } from "@cantoo/pdf-lib";

/**
 * Removes password protection from a PDF, given the correct password.
 * @param {File} file
 * @param {string} password
 */
export async function unlockPdf(file, password, onProgress) {
  const bytes = await file.arrayBuffer();
  onProgress?.(15);

  let doc;
  try {
    doc = await PDFDocument.load(bytes, { password: password || undefined });
  } catch {
    throw new Error(
      "Kata sandi salah, atau file bukan PDF yang valid/terenkripsi."
    );
  }
  onProgress?.(60);

  // Saving a document loaded with the correct password (and without calling
  // .encrypt() again) writes it back out with no encryption dictionary.
  const outBytes = await doc.save();
  onProgress?.(100);
  return new Blob([outBytes], { type: "application/pdf" });
}

/** Quick check so the UI can tell the user upfront if a file is encrypted. */
export async function isPdfEncrypted(file) {
  try {
    const bytes = await file.arrayBuffer();
    await PDFDocument.load(bytes, { ignoreEncryption: false });
    return false;
  } catch {
    return true;
  }
}
