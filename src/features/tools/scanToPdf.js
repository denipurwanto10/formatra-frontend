import { PDFDocument } from "@cantoo/pdf-lib";
import { preprocessScanCanvas } from "./imagePreprocess";

const MARGIN = 24; // pt
const A4 = [595.28, 841.89];

function loadImageEl(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Gagal membaca gambar"));
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Turns a camera photo into something that reads like a proper document
 * scan: auto-straightens it (deskew), crops out background/desk around the
 * page (auto-crop), then applies a per-photo auto-levels contrast pass
 * (enhance) — replacing the previous fixed grayscale/contrast/brightness
 * filter, which did nothing for a crooked shot and could crush an
 * already-good one.
 */
async function enhance(file) {
  const img = await loadImageEl(file);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(img.src);

  const processed = preprocessScanCanvas(canvas);

  return new Promise((resolve, reject) => {
    processed.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Gagal memproses gambar"))),
      "image/jpeg",
      0.92
    );
  });
}

/**
 * Turn a set of photos (camera captures or gallery picks) into a single PDF,
 * one page per photo, each fit to an A4 page. Optionally runs a grayscale +
 * contrast pass first so the result reads like a proper document scan.
 * @param {File[]} files
 * @param {{enhance?: boolean}} opts
 */
export async function scanToPdf(files, { enhance: shouldEnhance = true } = {}, onProgress) {
  const doc = await PDFDocument.create();

  for (let i = 0; i < files.length; i += 1) {
    const original = files[i];
    // eslint-disable-next-line no-await-in-loop
    const bytes = shouldEnhance ? await (await enhance(original)).arrayBuffer() : await original.arrayBuffer();
    const isPng = !shouldEnhance && (/png$/i.test(original.type) || /\.png$/i.test(original.name));
    // eslint-disable-next-line no-await-in-loop
    const image = isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);

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

    onProgress?.(Math.round(((i + 1) / files.length) * 95));
  }

  const outBytes = await doc.save();
  onProgress?.(100);
  return new Blob([outBytes], { type: "application/pdf" });
}
