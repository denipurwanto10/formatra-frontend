// Shared, editor-session-scoped cache of each source page's extracted text
// lines (geometry from pdf.js) plus their real font/colour styles (from the
// content stream, see pdfLineStyles.js). Both `PdfCanvas` (the "Edit Teks
// Asli" tool) and `FindReplaceBar` need the same data — this makes sure a
// page is only ever parsed once, however many places ask for it.

import { extractPageTextLines } from "./textLines";
import { getLineStyles, resetLineStylesCache } from "./pdfLineStyles";

/** pageId -> { lines, flatItems, hasText, styles: Map<number, style>|null } */
export const pageTextCache = new Map();

/**
 * Ensure a source page's lines (and, best-effort, styles) are cached.
 * Safe to call repeatedly — later calls just return the cached entry, and
 * concurrent calls for the same page share one in-flight extraction.
 */
export async function ensurePageTextCached(pdfDoc, pageMeta, originalFile) {
  if (!pdfDoc || !pageMeta || pageMeta.kind !== "source") return null;

  let entry = pageTextCache.get(pageMeta.id);
  if (!entry) {
    const pending = pdfDoc.getPage(pageMeta.sourceIndex + 1).then((page) => extractPageTextLines(page));
    // Store the in-flight promise immediately so a second concurrent call
    // for the same page reuses it instead of parsing twice.
    pageTextCache.set(pageMeta.id, pending);
    const { lines, flatItems } = await pending;
    entry = { lines, flatItems, hasText: flatItems.length > 0, styles: null };
    pageTextCache.set(pageMeta.id, entry);
  } else if (entry.then) {
    entry = await entry; // another caller's extraction is already in flight
  }

  if (!entry.styles && entry.hasText && originalFile) {
    try {
      entry.styles = await getLineStyles(originalFile, pageMeta.sourceIndex, entry.lines, entry.flatItems);
    } catch {
      entry.styles = new Map();
    }
  }

  return entry;
}

/** Call when a new file is opened / the editor resets. */
export function clearPageTextCache() {
  pageTextCache.clear();
  resetLineStylesCache();
}
