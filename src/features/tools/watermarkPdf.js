import { PDFDocument, StandardFonts, rgb, degrees } from "@cantoo/pdf-lib";

/**
 * @param {File} file
 * @param {object} opts
 * @param {string} opts.text
 * @param {number} opts.opacity 0-1
 * @param {number} opts.rotation degrees
 * @param {number} opts.fontSize
 * @param {"diagonal"|"center"|"tiled"} opts.layout
 * @param {string} opts.color hex color e.g. #2f6fed
 */
export async function watermarkPdf(file, opts, onProgress) {
  const {
    text,
    opacity = 0.25,
    rotation = -35,
    fontSize = 48,
    layout = "diagonal",
    color = "#667085",
  } = opts;

  const bytes = await file.arrayBuffer();
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const [r, g, b] = hexToRgb(color);
  const pages = doc.getPages();

  pages.forEach((page, i) => {
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(text, fontSize);

    if (layout === "tiled") {
      const stepX = textWidth + 80;
      const stepY = fontSize + 90;
      for (let y = -height; y < height * 2; y += stepY) {
        for (let x = -width; x < width * 2; x += stepX) {
          page.drawText(text, {
            x,
            y,
            size: fontSize,
            font,
            color: rgb(r, g, b),
            opacity,
            rotate: degrees(rotation),
          });
        }
      }
    } else {
      page.drawText(text, {
        x: width / 2 - Math.cos((rotation * Math.PI) / 180) * (textWidth / 2),
        y: height / 2,
        size: fontSize,
        font,
        color: rgb(r, g, b),
        opacity,
        rotate: degrees(rotation),
      });
    }

    onProgress?.(Math.round(((i + 1) / pages.length) * 90));
  });

  const outBytes = await doc.save();
  onProgress?.(100);
  return new Blob([outBytes], { type: "application/pdf" });
}

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  const num = parseInt(clean, 16);
  return [((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255];
}
