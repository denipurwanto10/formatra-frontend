import { PDFDocument, StandardFonts, rgb } from "@cantoo/pdf-lib";

const POSITIONS = {
  "bottom-center": (w, _h, tw) => ({ x: (w - tw) / 2, y: 24 }),
  "bottom-right": (w, _h, tw) => ({ x: w - tw - 32, y: 24 }),
  "bottom-left": (_w, _h, _tw) => ({ x: 32, y: 24 }),
  "top-center": (w, h, tw) => ({ x: (w - tw) / 2, y: h - 40 }),
  "top-right": (w, h, tw) => ({ x: w - tw - 32, y: h - 40 }),
  "top-left": (_w, h, _tw) => ({ x: 32, y: h - 40 }),
};

/**
 * Stamp page numbers (and/or a header/footer text) onto every page.
 * @param {File} file
 * @param {object} opts
 * @param {boolean} opts.showPageNumbers
 * @param {string} opts.format e.g. "Halaman {n} dari {total}" or "{n} / {total}" or "{n}"
 * @param {keyof typeof POSITIONS} opts.position
 * @param {string} [opts.headerText] optional extra text stamped at the top
 * @param {number} [opts.startAt] number to start counting from (default 1)
 * @param {number} [opts.fontSize]
 */
export async function addPageNumbers(file, opts, onProgress) {
  const {
    showPageNumbers = true,
    format = "{n} / {total}",
    position = "bottom-center",
    headerText = "",
    startAt = 1,
    fontSize = 10,
  } = opts;

  const bytes = await file.arrayBuffer();
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  const total = pages.length;
  const place = POSITIONS[position] || POSITIONS["bottom-center"];

  pages.forEach((page, i) => {
    const { width, height } = page.getSize();

    if (showPageNumbers) {
      const label = format
        .replaceAll("{n}", String(i + startAt))
        .replaceAll("{total}", String(total));
      const tw = font.widthOfTextAtSize(label, fontSize);
      const { x, y } = place(width, height, tw);
      page.drawText(label, {
        x,
        y,
        size: fontSize,
        font,
        color: rgb(0.35, 0.38, 0.44),
      });
    }

    if (headerText) {
      const htw = font.widthOfTextAtSize(headerText, fontSize);
      page.drawText(headerText, {
        x: (width - htw) / 2,
        y: height - 28,
        size: fontSize,
        font,
        color: rgb(0.35, 0.38, 0.44),
      });
    }

    onProgress?.(Math.round(((i + 1) / total) * 90));
  });

  const outBytes = await doc.save();
  onProgress?.(100);
  return new Blob([outBytes], { type: "application/pdf" });
}
