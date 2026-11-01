import { PDFDocument } from "@cantoo/pdf-lib";

/** Reads the current metadata fields of a PDF so a form can be pre-filled. */
export async function readMetadata(file) {
  const bytes = await file.arrayBuffer();
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  return {
    title: doc.getTitle() || "",
    author: doc.getAuthor() || "",
    subject: doc.getSubject() || "",
    keywords: (doc.getKeywords() || "").toString(),
    creator: doc.getCreator() || "",
    producer: doc.getProducer() || "",
    pageCount: doc.getPageCount(),
  };
}

/**
 * @param {File} file
 * @param {{title?:string, author?:string, subject?:string, keywords?:string, creator?:string}} fields
 */
export async function writeMetadata(file, fields, onProgress) {
  const bytes = await file.arrayBuffer();
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  onProgress?.(30);

  doc.setTitle(fields.title || "");
  doc.setAuthor(fields.author || "");
  doc.setSubject(fields.subject || "");
  doc.setKeywords(
    (fields.keywords || "")
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean)
  );
  doc.setCreator(fields.creator || "Formatra");
  doc.setProducer("Formatra");
  doc.setModificationDate(new Date());
  onProgress?.(70);

  const outBytes = await doc.save();
  onProgress?.(100);
  return new Blob([outBytes], { type: "application/pdf" });
}
