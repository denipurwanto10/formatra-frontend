/**
 * Shared scan-quality preprocessing for scanToPdf.js and ocrPdf.js:
 * deskew, auto-crop, and adaptive contrast/brightness enhancement.
 *
 * All three previously only had (or had no) fixed CSS filters
 * (`grayscale(1) contrast(1.35) brightness(1.08)`), which does nothing for
 * a crooked phone photo and can crush already-good scans. This module
 * replaces that with content-aware passes:
 *
 *  - `estimateSkewAngle` / `deskewCanvas`: classic projection-profile method
 *    — rotate a small binarized copy across a range of candidate angles and
 *    keep the one whose row-brightness projection has the highest variance
 *    (text rows become sharply darker than gaps only once truly horizontal).
 *  - `autoCropToContent`: scans for the bounding box of non-background
 *    pixels (with a small margin) and crops to it, removing dark scanner
 *    borders/background left after deskewing.
 *  - `enhanceCanvas`: per-image histogram stretch (auto-levels) instead of a
 *    one-size-fits-all filter, so both under- and over-exposed photos land
 *    close to full black/white contrast without clipping already-good scans.
 *
 * Every step degrades gracefully: if a page has too little content to get a
 * confident read (near-blank page, solid-color image), the corresponding
 * step is skipped and the original canvas passed through untouched, rather
 * than risking cropping/rotating a page into something worse.
 */

/** Draws `source` (an <img>/<canvas>/ImageBitmap) onto a new canvas at a given max dimension, for cheap analysis. */
function toAnalysisCanvas(source, maxDim = 700) {
  const srcW = source.naturalWidth || source.width;
  const srcH = source.naturalHeight || source.height;
  const scale = Math.min(1, maxDim / Math.max(srcW, srcH));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(srcW * scale));
  canvas.height = Math.max(1, Math.round(srcH * scale));
  canvas.getContext("2d").drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Grayscale luminance ImageData, plus a global mean used as the binarization threshold. */
function grayscaleData(canvas) {
  const ctx = canvas.getContext("2d");
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const gray = new Uint8ClampedArray(width * height);
  let sum = 0;
  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    gray[p] = lum;
    sum += lum;
  }
  return { gray, width, height, mean: sum / gray.length };
}

/** Row-projection "sharpness" (variance of per-row dark-pixel counts) for one rotation angle. */
function projectionVarianceAtAngle(gray, width, height, threshold, angleRad) {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const cx = width / 2;
  const cy = height / 2;
  const diag = Math.ceil(Math.sqrt(width * width + height * height));
  const rowSums = new Float64Array(diag);

  // Inverse-map each destination row/col back into source space (nearest
  // neighbour) instead of physically rendering a rotated canvas per angle —
  // avoids ~20 extra canvas allocations per page.
  for (let dy = 0; dy < diag; dy += 2) {
    // step 2px for speed; skew estimation doesn't need every row
    let count = 0;
    const oy = dy - diag / 2;
    for (let dx = 0; dx < diag; dx += 2) {
      const ox = dx - diag / 2;
      const sx = Math.round(cx + ox * cos - oy * sin);
      const sy = Math.round(cy + ox * sin + oy * cos);
      if (sx < 0 || sx >= width || sy < 0 || sy >= height) continue;
      if (gray[sy * width + sx] < threshold) count += 1;
    }
    rowSums[dy] = count;
  }

  let sum = 0;
  let n = 0;
  for (let i = 0; i < diag; i += 2) {
    sum += rowSums[i];
    n += 1;
  }
  const mean = n ? sum / n : 0;
  let variance = 0;
  for (let i = 0; i < diag; i += 2) {
    const d = rowSums[i] - mean;
    variance += d * d;
  }
  return n ? variance / n : 0;
}

/**
 * Estimates the skew angle (degrees, positive = clockwise) of a page image.
 * Searches a coarse range first, then refines around the best candidate.
 * Returns 0 if the page has too little dark content to measure confidently
 * (e.g. a near-blank page) rather than guessing.
 */
export function estimateSkewAngle(source, { maxAbsAngle = 12 } = {}) {
  const small = toAnalysisCanvas(source, 500);
  const { gray, width, height, mean } = grayscaleData(small);
  const threshold = mean * 0.85; // pixels notably darker than average count as "ink"

  const darkFraction =
    gray.reduce((acc, v) => acc + (v < threshold ? 1 : 0), 0) / gray.length;
  if (darkFraction < 0.005 || darkFraction > 0.6) {
    // Essentially blank, or mostly-dark (e.g. a photo, not a document) —
    // the projection method isn't reliable here, so don't touch rotation.
    return 0;
  }

  const coarseStep = 1;
  let bestAngle = 0;
  let bestScore = -Infinity;
  for (let a = -maxAbsAngle; a <= maxAbsAngle; a += coarseStep) {
    const score = projectionVarianceAtAngle(gray, width, height, threshold, (a * Math.PI) / 180);
    if (score > bestScore) {
      bestScore = score;
      bestAngle = a;
    }
  }

  const fineStep = 0.2;
  for (let a = bestAngle - 1; a <= bestAngle + 1; a += fineStep) {
    const score = projectionVarianceAtAngle(gray, width, height, threshold, (a * Math.PI) / 180);
    if (score > bestScore) {
      bestScore = score;
      bestAngle = a;
    }
  }

  return Math.round(bestAngle * 10) / 10;
}

/** Rotates a canvas by `angleDeg` (degrees) around its center, expanding the canvas to fit, filled with white. */
export function rotateCanvas(source, angleDeg) {
  if (!angleDeg) return source;
  const w = source.width;
  const h = source.height;
  const rad = (angleDeg * Math.PI) / 180;
  const newW = Math.ceil(Math.abs(w * Math.cos(rad)) + Math.abs(h * Math.sin(rad)));
  const newH = Math.ceil(Math.abs(w * Math.sin(rad)) + Math.abs(h * Math.cos(rad)));
  const canvas = document.createElement("canvas");
  canvas.width = newW;
  canvas.height = newH;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, newW, newH);
  ctx.translate(newW / 2, newH / 2);
  ctx.rotate(rad);
  ctx.drawImage(source, -w / 2, -h / 2);
  return canvas;
}

/** Detects skew and returns a corrected (and slightly larger, white-padded) canvas. No-op if skew is negligible. */
export function deskewCanvas(source, opts) {
  const angle = estimateSkewAngle(source, opts);
  if (Math.abs(angle) < 0.3) return source;
  return rotateCanvas(source, -angle);
}

/**
 * Crops to the bounding box of non-background content, with a small margin.
 * Falls back to the original canvas untouched if no clear content region is
 * found (blank page, or content touching every edge already).
 */
export function autoCropToContent(source, { marginRatio = 0.02, threshold = 250 } = {}) {
  const analysisMax = 900;
  const scale = Math.min(1, analysisMax / Math.max(source.width, source.height));
  const small = toAnalysisCanvas(source, analysisMax);
  const ctx = small.getContext("2d");
  const { data, width, height } = ctx.getImageData(0, 0, small.width, small.height);

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (lum < threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0 || maxY < 0) return source; // nothing darker than threshold found
  const contentW = maxX - minX;
  const contentH = maxY - minY;
  if (contentW < width * 0.05 || contentH < height * 0.05) return source; // too little to trust

  const marginX = contentW * marginRatio;
  const marginY = contentH * marginRatio;
  const cropX = Math.max(0, minX - marginX);
  const cropY = Math.max(0, minY - marginY);
  const cropW = Math.min(width, maxX + marginX) - cropX;
  const cropH = Math.min(height, maxY + marginY) - cropY;

  // Nothing meaningful to crop (content already fills the page).
  if (cropX < 1 && cropY < 1 && cropW > width - 2 && cropH > height - 2) return source;

  const out = document.createElement("canvas");
  out.width = Math.round(cropW / scale);
  out.height = Math.round(cropH / scale);
  out
    .getContext("2d")
    .drawImage(
      source,
      cropX / scale,
      cropY / scale,
      cropW / scale,
      cropH / scale,
      0,
      0,
      out.width,
      out.height
    );
  return out;
}

/**
 * Per-image histogram stretch ("auto levels"): remaps the darkest ~0.5% and
 * lightest ~0.5% of pixels to pure black/white and linearly stretches
 * everything between, then applies a mild grayscale conversion. Adapts to
 * each photo's actual exposure instead of one fixed contrast/brightness
 * multiplier, so it doesn't crush shadows on an already-good scan or leave
 * a dim photo washed out.
 */
export function enhanceCanvas(source, { grayscale = true } = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(source, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;

  const histogram = new Uint32Array(256);
  const lumAt = (i) => Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
  for (let i = 0; i < data.length; i += 4) histogram[lumAt(i)] += 1;

  const totalPixels = data.length / 4;
  const clip = totalPixels * 0.005;
  let lo = 0;
  let acc = 0;
  while (lo < 255 && acc < clip) {
    acc += histogram[lo];
    lo += 1;
  }
  let hi = 255;
  acc = 0;
  while (hi > 0 && acc < clip) {
    acc += histogram[hi];
    hi -= 1;
  }
  if (hi <= lo) return source; // degenerate (flat/blank) image — nothing safe to stretch

  const range = hi - lo;
  const stretch = (v) => Math.max(0, Math.min(255, ((v - lo) / range) * 255));

  for (let i = 0; i < data.length; i += 4) {
    if (grayscale) {
      const lum = stretch(lumAt(i));
      data[i] = lum;
      data[i + 1] = lum;
      data[i + 2] = lum;
    } else {
      data[i] = stretch(data[i]);
      data[i + 1] = stretch(data[i + 1]);
      data[i + 2] = stretch(data[i + 2]);
    }
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Full pipeline used by scanToPdf/ocrPdf: deskew -> auto-crop -> enhance.
 * Each step already no-ops safely on input it isn't confident about, so
 * this is safe to run unconditionally on any page/photo.
 */
export function preprocessScanCanvas(source, { deskew = true, crop = true, enhance = true } = {}) {
  let result = source;
  if (deskew) result = deskewCanvas(result);
  if (crop) result = autoCropToContent(result);
  if (enhance) result = enhanceCanvas(result);
  return result;
}
