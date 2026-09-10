import { PDFDocument } from "@cantoo/pdf-lib";

const MARGIN = 24; // pt

/**
 * @param {File[]} files ordered image files
 * @param {"fit"|"original"} pageSize "fit" = A4 with image fit inside; "original" = page matches image size
 */
export async function imagesToPdf(files, { pageSize = "fit" } = {}, onProgress) {
  const doc = await PDFDocument.create();
  const A4 = [595.28, 841.89];

  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    const bytes = await file.arrayBuffer();
    const isPng = /png$/i.test(file.type) || /\.png$/i.test(file.name);
    const image = isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);

    if (pageSize === "original") {
      const page = doc.addPage([image.width, image.height]);
      page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
    } else {
      const page = doc.addPage(A4);
      const maxW = A4[0] - MARGIN * 2;
      const maxH = A4[1] - MARGIN * 2;
      const scale = Math.min(maxW / image.width, maxH / image.height, 1);
      const w = image.width * scale;
      const h = image.height * scale;
      page.drawImage(image, {
        x: (A4[0] - w) / 2,
        y: (A4[1] - h) / 2,
        width: w,
        height: h,
      });
    }

    onProgress?.(Math.round(((i + 1) / files.length) * 90));
  }

  const outBytes = await doc.save();
  onProgress?.(100);
  return new Blob([outBytes], { type: "application/pdf" });
}
