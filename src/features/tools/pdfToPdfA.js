// Client-side PDF -> PDF/A conversion (archival format for official /
// institutional use) using the PDF/A support built into the project's
// pinned @cantoo/pdf-lib: `convertToPDFA()` installs the document /ID,
// an OutputIntent with an embedded sRGB ICC profile, and identifying XMP
// metadata, then `save()` keeps Info<->XMP in sync.
//
// Honest scope (mirrors the library's own docs, surfaced in the UI too):
// conversion performs the *structural* PDF/A steps but cannot guarantee full
// compliance by itself — encrypted files, non-embedded fonts, transparency
// (part 1), JavaScript or external references in the source can still fail a
// validator such as veraPDF. Encrypted PDFs are rejected up front with a
// plain-language error.

import { PDFDocument } from "@cantoo/pdf-lib";

export const PDFA_CONFORMANCE_LEVELS = [
  {
    id: "2B",
    title: "PDF/A-2b — disarankan",
    description:
      "Paling umum diterima instansi. Menjamin tampilan visual dapat direproduksi dengan andal.",
  },
  {
    id: "1B",
    title: "PDF/A-1b — kompatibilitas maksimum",
    description:
      "Standar tertua (basis PDF 1.4). Pilih ini bila instansi secara eksplisit meminta PDF/A-1.",
  },
  {
    id: "3B",
    title: "PDF/A-3b — boleh lampiran",
    description: "Seperti 2b, tetapi mengizinkan file lampiran arbitrer di dalam PDF.",
  },
  {
    id: "2U",
    title: "PDF/A-2u — plus Unicode",
    description:
      "Seperti 2b, ditambah persyaratan pemetaan Unicode untuk semua teks. Cocok bila dokumen akan diindeks/dicari teksnya di arsip.",
  },
  {
    id: "3U",
    title: "PDF/A-3u — lampiran + Unicode",
    description: "Gabungan 3b dan 2u: lampiran diizinkan, teks harus terpetakan ke Unicode.",
  },
];

/**
 * @param {File} file
 * @param {object} options
 * @param {"1B"|"2B"|"2U"|"3B"|"3U"} [options.conformance="2B"]
 * @param {(progress:number)=>void} [onProgress]
 * @returns {Promise<Blob>}
 */
export async function pdfToPdfA(file, options = {}, onProgress) {
  const { conformance = "2B" } = options;
  onProgress?.(10);

  const bytes = await file.arrayBuffer();
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  onProgress?.(30);

  if (doc.isEncrypted) {
    throw new Error(
      "File PDF ini terproteksi kata sandi. PDF/A tidak mengizinkan enkripsi — buka kunci PDF terlebih dahulu (tool Buka Kunci PDF), lalu konversi lagi."
    );
  }

  // Preserve the source document's bibliographic info; the library keeps
  // Info<->XMP consistent on save after convertToPDFA() runs.
  const baseName = file.name.replace(/\.[^/.]+$/, "");
  if (!doc.getTitle()) doc.setTitle(baseName);
  doc.setCreator(doc.getCreator() || "Formatra");
  doc.setProducer("Formatra (PDF/A)");
  doc.setModificationDate(new Date());
  onProgress?.(50);

  doc.convertToPDFA({ conformance });
  onProgress?.(75);

  // No explicit save options: save() already disables object streams for
  // PDF/A-1 (which forbids them) and the conversion keeps XMP in sync.
  const outBytes = await doc.save();
  onProgress?.(100);
  return new Blob([outBytes], { type: "application/pdf" });
}
