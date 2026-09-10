import { PDFDocument } from "@cantoo/pdf-lib";

/**
 * @param {File} file
 * @param {object} opts
 * @param {string} opts.userPassword required to open the file
 * @param {string} [opts.ownerPassword] required to change permissions; defaults to userPassword
 * @param {"AES-256"|"AES-128"} [opts.algorithm]
 * @param {object} [opts.permissions]
 */
export async function protectPdf(file, opts, onProgress) {
  const {
    userPassword,
    ownerPassword,
    algorithm = "AES-256",
    permissions = {
      printing: "highResolution",
      modifying: false,
      copying: true,
      annotating: true,
      fillingForms: true,
      contentAccessibility: true,
      documentAssembly: false,
    },
  } = opts;

  const bytes = await file.arrayBuffer();
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  onProgress?.(30);

  doc.encrypt({
    userPassword,
    ownerPassword: ownerPassword || userPassword,
    algorithm,
    permissions,
  });
  onProgress?.(70);

  const outBytes = await doc.save();
  onProgress?.(100);
  return new Blob([outBytes], { type: "application/pdf" });
}
