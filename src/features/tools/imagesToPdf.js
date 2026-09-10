import { PDFDocument } from "@cantoo/pdf-lib";

const MARGIN = 24; // pt

/**
 * Decodes `file` through the canvas and re-encodes it, baking in the EXIF
 * orientation along the way.
 *
 * Phone camera photos are usually stored sensor-side-up with an EXIF
 * "Orientation" tag telling viewers how to rotate them for display. pdf-lib
 * has no idea EXIF exists — `embedJpg`/`embedPng` just place the raw pixel
 * grid on the page — so without this step those photos land in the PDF
 * sideways or upside-down even though every other viewer on the phone shows
 * them right-side up. `createImageBitmap(..., { imageOrientation:
 * "from-image" })` applies that rotation while decoding, and drawing the
 * result to a canvas then re-reading it back out gives us pixel bytes that
 * are already correctly oriented, so the PDF just matches what the user saw
 * when picking the photo.
 */
async function normalizeOrientation(file) {
  let source;
  let width;
  let height;

  if (typeof createImageBitmap === "function") {
    try {
      source = await createImageBitmap(file, { imageOrientation: "from-image" });
      width = source.width;
      height = source.height;
    } catch {
      // Some browsers/formats can't decode via createImageBitmap — fall
      // back to a plain <img>, which browsers also orient correctly when
      // painting by default.
      source = null;
    }
  }

  if (!source) {
    source = await loadImageElement(file);
    width = source.naturalWidth;
    height = source.naturalHeight;
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(source, 0, 0, width, height);
  if (source.close) source.close(); // release ImageBitmap memory

  const isPng = /png$/i.test(file.type) || /\.png$/i.test(file.name);
  const mime = isPng ? "image/png" : "image/jpeg";
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Gagal memproses gambar untuk PDF."))),
      mime,
      mime === "image/jpeg" ? 0.95 : undefined
    );
  });

  return { bytes: await blob.arrayBuffer(), isPng, width, height };
}

function loadImageElement(file) {
  const url = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Gagal membaca file gambar. Pastikan formatnya JPG atau PNG yang valid."));
    };
    img.src = url;
  });
}

/**
 * @param {File[]} files ordered image files
 * @param {"fit"|"original"} pageSize "fit" = A4 with image fit inside; "original" = page matches image size
 */
export async function imagesToPdf(files, { pageSize = "fit" } = {}, onProgress) {
  const doc = await PDFDocument.create();
  const A4 = [595.28, 841.89];

  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    const { bytes, isPng, width: imgWidth, height: imgHeight } = await normalizeOrientation(file);
    const image = isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);

    if (pageSize === "original") {
      const page = doc.addPage([imgWidth, imgHeight]);
      page.drawImage(image, { x: 0, y: 0, width: imgWidth, height: imgHeight });
    } else {
      const page = doc.addPage(A4);
      const maxW = A4[0] - MARGIN * 2;
      const maxH = A4[1] - MARGIN * 2;
      const scale = Math.min(maxW / imgWidth, maxH / imgHeight, 1);
      const w = imgWidth * scale;
      const h = imgHeight * scale;
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
