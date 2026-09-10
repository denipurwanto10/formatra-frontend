import { loadPdfDocument } from "../../lib/pdfjs";

/**
 * Extract plain text from every page of a PDF, in reading order.
 * @param {File} file
 * @param {(progress:number) => void} onProgress
 * @returns {Promise<{text: string, hasTextLayer: boolean}>}
 */
export async function pdfToTxt(file, onProgress) {
  const pdfDoc = await loadPdfDocument(file);
  const total = pdfDoc.numPages;
  const pageTexts = [];
  let totalChars = 0;

  for (let i = 1; i <= total; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const page = await pdfDoc.getPage(i);
    // eslint-disable-next-line no-await-in-loop
    const content = await page.getTextContent();
    let lastY = null;
    let line = "";
    const lines = [];
    content.items.forEach((item) => {
      if (!item.str) return;
      const y = item.transform[5];
      if (lastY !== null && Math.abs(y - lastY) > 2) {
        lines.push(line);
        line = "";
      }
      line += item.str;
      lastY = y;
    });
    if (line) lines.push(line);
    const pageText = lines.join("\n").trim();
    totalChars += pageText.length;
    pageTexts.push(pageText);
    onProgress?.(Math.round((i / total) * 100));
  }

  return {
    text: pageTexts.join("\n\n"),
    hasTextLayer: totalChars > 0,
  };
}
