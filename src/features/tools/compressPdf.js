import { PDFDocument } from "@cantoo/pdf-lib";
import { loadPdfDocument, renderPageToCanvas } from "../../lib/pdfjs";

/**
 * Lossless mode: re-serializes the PDF with compressed cross-reference/object
 * streams. Safe, keeps text selectable, but savings are modest — real size
 * comes mostly from re-encoding embedded images, which this mode does not touch.
 */
async function compressLossless(file, onProgress) {
  const bytes = await file.arrayBuffer();
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  onProgress?.(50);
  const outBytes = await doc.save({ useObjectStreams: true });
  onProgress?.(100);
  return new Blob([outBytes], { type: "application/pdf" });
}

/**
 * Aggressive mode: rasterizes every page to a JPEG at the given DPI/quality and
 * rebuilds the PDF from those images. Shrinks file size a lot, especially for
 * scanned or image-heavy PDFs, but text stops being selectable/searchable.
 */
async function compressRasterize(file, { scale = 1.4, quality = 0.6 } = {}, onProgress) {
  const pdfDoc = await loadPdfDocument(file);
  const total = pdfDoc.numPages;
  const out = await PDFDocument.create();

  for (let i = 1; i <= total; i += 1) {
    const { canvas, viewport } = await renderPageToCanvas(pdfDoc, i, scale);
    const jpegDataUrl = canvas.toDataURL("image/jpeg", quality);
    const jpegBytes = await (await fetch(jpegDataUrl)).arrayBuffer();
    const image = await out.embedJpg(jpegBytes);

    // Keep the page's original point-size (viewport at scale 1) so the output
    // isn't physically larger than the source, only the pixel density changes.
    const pageWidthPt = viewport.width / scale;
    const pageHeightPt = viewport.height / scale;
    const page = out.addPage([pageWidthPt, pageHeightPt]);
    page.drawImage(image, { x: 0, y: 0, width: pageWidthPt, height: pageHeightPt });

    onProgress?.(Math.round((i / total) * 90));
  }

  const outBytes = await out.save();
  onProgress?.(100);
  return new Blob([outBytes], { type: "application/pdf" });
}

const RASTERIZE_PRESETS = {
  balanced: { scale: 1.8, quality: 0.75 },
  strong: { scale: 1.2, quality: 0.5 },
};

/**
 * @param {File} file
 * @param {"lossless"|"balanced"|"strong"|object} options compression level string or options object
 * @param {string} [options.level="lossless"] compression level
 * @param {number|null} [options.targetSizeMB] target output size in MB; if set, will iteratively compress until under this size
 */
export async function compressPdf(file, options = "lossless", onProgress) {
  // Handle backward compatibility with old string parameter
  const opts = typeof options === 'string' ? { level: options } : options;
  const { level = "lossless", targetSizeMB = null } = opts;

  // If target size is specified, use iterative compression
  if (targetSizeMB && targetSizeMB > 0) {
    const targetBytes = targetSizeMB * 1024 * 1024;
    
    // Try different compression levels based on initial level
    const levelsToTry = level === "lossless" 
      ? ["lossless", "balanced", "strong"] 
      : level === "balanced" 
        ? ["balanced", "strong"] 
        : ["strong"];
    
    let result = null;
    let bestResult = null;
    
    for (let i = 0; i < levelsToTry.length; i++) {
      const currentLevel = levelsToTry[i];
      onProgress?.(Math.min(100, 10 + Math.floor((i / levelsToTry.length) * 80)));
      
      if (currentLevel === "lossless") {
        result = await compressLossless(file, onProgress);
      } else {
        result = await compressRasterize(file, RASTERIZE_PRESETS[currentLevel], onProgress);
      }
      
      if (result.size <= targetBytes) {
        // We found a result under target size, return it
        onProgress?.(100);
        return result;
      }
      
      // Keep track of the smallest result so far (even if over target)
      if (!bestResult || result.size < bestResult.size) {
        bestResult = result;
      }
    }
    
    // If we couldn't reach target size, return the best result we got
    onProgress?.(100);
    if (bestResult && bestResult.size > targetBytes) {
      console.warn(`Tidak bisa kompres ke bawah ${targetSizeMB}MB. Hasil terbaik: ${(bestResult.size / (1024 * 1024)).toFixed(2)}MB`);
    }
    return bestResult || result;
  }
  
  // Standard compression without target size
  if (level === "balanced" || level === "strong") {
    return compressRasterize(file, RASTERIZE_PRESETS[level], onProgress);
  }
  return compressLossless(file, onProgress);
}
