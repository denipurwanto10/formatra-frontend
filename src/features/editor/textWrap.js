/**
 * Greedy word-wrap matching how fabric's Textbox breaks lines (word
 * boundaries only — this codebase creates all Textboxes with
 * `splitByGrapheme: false`, so a single word that can't fit is left
 * unbroken rather than split mid-word). Used at export time so the PDF's
 * line breaks land in the same places the user saw on screen, instead of
 * pdf-lib's `drawText`, which never wraps and would otherwise draw a whole
 * paragraph running off the page as one line. Existing `\n` (real,
 * user-typed line breaks) are always respected as hard breaks first.
 *
 * @param {string} text
 * @param {{ widthOfTextAtSize: (text: string, size: number) => number }} font  a pdf-lib PDFFont (or anything with the same measuring method)
 * @param {number} fontSize
 * @param {number} maxWidth  0/undefined disables wrapping (only `\n` splits)
 * @returns {string[]}
 */
export function wrapTextToWidth(text, font, fontSize, maxWidth) {
  const hardLines = String(text ?? "").split("\n");
  if (!maxWidth || maxWidth <= 0) return hardLines;
  const wrapped = [];
  hardLines.forEach((hardLine) => {
    const words = hardLine.split(" ");
    let current = "";
    words.forEach((word) => {
      const candidate = current ? `${current} ${word}` : word;
      if (current && font.widthOfTextAtSize(candidate, fontSize) > maxWidth) {
        wrapped.push(current);
        current = word;
      } else {
        current = candidate;
      }
    });
    wrapped.push(current);
  });
  return wrapped;
}
