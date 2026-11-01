// Edit-time text styling, sourced from the PDF itself rather than guessed.
//
// `textLines.js` already gives pixel-accurate geometry from pdf.js. For
// colour and font family, PdfCanvas used to fall back to sampling pixels off
// the rendered page — a decent guess, but pdfTextRedact.js (used at export
// time) already does something far more precise: it walks the page's real
// content-stream operators and tracks the active font/fill colour at every
// `Tj`/`TJ` show-text op. This module reuses that same walk so the editor UI
// can show (and start from) the *real* PDF colour/weight/family the moment
// you click a line, instead of only getting it right after export.
//
// Best-effort by design: any parsing failure here just means the caller
// falls back to its existing pixel-sampling heuristic — never a hard error.

import { PDFDocument } from "@cantoo/pdf-lib";
import {
  getPageOperations,
  buildOperatorRecords,
  matchOperatorsToItems,
  guessStandardFont,
} from "./pdfTextRedact";

// One parsed pdf-lib document per source File, reused across pages/edits.
let cachedFile = null;
let cachedDocPromise = null;

function loadLibDoc(file) {
  if (cachedFile === file && cachedDocPromise) return cachedDocPromise;
  cachedFile = file;
  cachedDocPromise = file
    .arrayBuffer()
    .then((bytes) => PDFDocument.load(bytes, { ignoreEncryption: true }));
  return cachedDocPromise;
}

/**
 * @param {File} file the original uploaded PDF
 * @param {number} sourceIndex 0-based page index in the *original* document
 * @param {Array} lines from `extractPageTextLines` (needs `.itemIndices`, `.italic`)
 * @param {Array} flatItems from `extractPageTextLines`, execution order
 * @returns {Promise<Map<number, {color:string, family:string, bold:boolean,
 *   italic:boolean, charSpacing:number, wordSpacing:number, hScale:number,
 *   rotation:number}>>}
 *   keyed by line index into `lines`
 */
export async function getLineStyles(file, sourceIndex, lines, flatItems) {
  const result = new Map();
  if (!file || !lines?.length || !flatItems?.length) return result;

  try {
    const doc = await loadLibDoc(file);
    const page = doc.getPages()[sourceIndex];
    if (!page) return result;

    const operations = getPageOperations(page);
    if (operations.length === 0) return result;

    const resources = page.node.normalizedEntries().Resources;
    const records = buildOperatorRecords(operations, resources);
    const matched = matchOperatorsToItems(records, flatItems);
    if (!matched) return result; // structure didn't line up 1:1 — don't guess

    lines.forEach((line, lineIndex) => {
      const first = matched[line.itemIndices?.[0]];
      if (!first) return;
      // `first.bold`/`first.italic` already fold in the /FontDescriptor
      // flags (see pdfTextRedact.js's buildFontDecoder); line.italic is
      // pdf.js's own shear-based detection, kept as a third vote so a
      // faux-italic transform with a descriptor/name that doesn't say so
      // still gets picked up.
      const guess = guessStandardFont(first.fontBaseName, line.italic || first.italic, first.bold);
      result.set(lineIndex, {
        color: first.color,
        charSpacing: first.charSpacing,
        wordSpacing: first.wordSpacing,
        hScale: first.hScale,
        rotation: line.rotation,
        // Raw PDF font name (e.g. "ArialMT", "Calibri-Bold") straight from
        // the content stream — kept alongside `guess`'s reduced
        // helvetica/times/courier export bucket so the on-screen editor can
        // render a much closer visual match (see `guessCssFontFamily` in
        // PdfCanvas.jsx) than the export format's 14-standard-font limit
        // allows.
        rawFontName: first.fontBaseName || "",
        ...guess,
      });
    });
  } catch {
    // Leave `result` as whatever was collected (usually empty) — caller
    // treats a missing entry as "fall back to sampling", never crashes.
  }
  return result;
}

/** Call when a new file is opened so a previous document isn't reused by mistake. */
export function resetLineStylesCache() {
  cachedFile = null;
  cachedDocPromise = null;
}
