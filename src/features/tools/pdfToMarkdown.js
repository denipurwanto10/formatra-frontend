import { loadPdfDocument } from "../../lib/pdfjs";

/** Groups text items on a page into visual lines using their baseline Y position. */
function groupItemsIntoLines(items) {
  const lines = [];
  let current = null;
  items.forEach((item) => {
    if (!item.str) return;
    const y = Math.round(item.transform[5]);
    const size = Math.abs(item.transform[3]) || Math.abs(item.transform[0]) || 0;
    if (current && Math.abs(current.y - y) <= 2) {
      current.text += item.str;
      current.maxSize = Math.max(current.maxSize, size);
      current.fonts.add(item.fontName);
    } else {
      current = { y, text: item.str, maxSize: size, fonts: new Set([item.fontName]) };
      lines.push(current);
    }
  });
  return lines;
}

function isBoldFont(fontName, styles) {
  const style = styles?.[fontName];
  const label = `${style?.fontFamily || ""} ${fontName || ""}`.toLowerCase();
  return label.includes("bold");
}

const BULLET_RE = /^[-•▪●○◦*]\s+/;
const NUMBERED_RE = /^\d+[.)]\s+/;

/**
 * Convert a PDF into Markdown by inferring headings/lists/emphasis from font
 * size, weight, and simple line patterns. This is a heuristic, layout-based
 * conversion (no external AI) — best for text-based PDFs with reasonably
 * consistent styling; scanned PDFs should go through OCR PDF first.
 * @param {File} file
 * @param {(progress:number) => void} onProgress
 * @returns {Promise<{markdown: string, hasTextLayer: boolean}>}
 */
export async function pdfToMarkdown(file, onProgress) {
  const pdfDoc = await loadPdfDocument(file);
  const total = pdfDoc.numPages;
  const pages = [];
  const sizeVotes = new Map();

  for (let i = 1; i <= total; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const page = await pdfDoc.getPage(i);
    // eslint-disable-next-line no-await-in-loop
    const content = await page.getTextContent();
    const lines = groupItemsIntoLines(content.items);
    lines.forEach((line) => {
      const key = Math.round(line.maxSize);
      if (key > 0) sizeVotes.set(key, (sizeVotes.get(key) || 0) + 1);
    });
    pages.push({ lines, styles: content.styles });
    onProgress?.(Math.round((i / total) * 45));
  }

  let bodySize = 0;
  let bodyVotes = -1;
  sizeVotes.forEach((count, size) => {
    if (count > bodyVotes) {
      bodyVotes = count;
      bodySize = size;
    }
  });

  const blocks = [];
  let totalChars = 0;

  pages.forEach((pageData, pageIndex) => {
    pageData.lines.forEach((line) => {
      const text = line.text.replace(/\s+/g, " ").trim();
      if (!text) return;
      totalChars += text.length;

      const size = Math.round(line.maxSize);
      const fontName = [...line.fonts][0];
      const bold = isBoldFont(fontName, pageData.styles);

      if (BULLET_RE.test(text)) {
        blocks.push(`- ${text.replace(BULLET_RE, "")}`);
        return;
      }
      if (NUMBERED_RE.test(text)) {
        blocks.push(text);
        return;
      }

      if (bodySize && size >= bodySize + 7) {
        blocks.push(`# ${text}`);
      } else if (bodySize && size >= bodySize + 3) {
        blocks.push(`## ${text}`);
      } else if (bodySize && size > bodySize && bold) {
        blocks.push(`### ${text}`);
      } else if (bold && text.length < 120) {
        blocks.push(`**${text}**`);
      } else {
        blocks.push(text);
      }
    });
    if (pageIndex < pages.length - 1) blocks.push("---");
    onProgress?.(45 + Math.round(((pageIndex + 1) / pages.length) * 55));
  });

  const markdown = blocks.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();

  return { markdown, hasTextLayer: totalChars > 0 };
}
