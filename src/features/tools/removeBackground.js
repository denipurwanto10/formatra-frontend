// Non-AI, canvas-only background removal (chroma-key style): samples the
// background color from the image's corners (or a point the user clicks)
// and flood-fills outward from the edges, making every pixel connected to
// the edge and close enough in color to that background fully transparent.
// The cutout edge is then feathered with a spatial distance transform so it
// doesn't look jagged.
//
// This only works well on a fairly flat, solid-color background (studio
// product shots, ID/passport photos, plain backdrops, screenshots) — unlike
// an AI segmentation model it can't tell foreground from background by
// meaning, only by color and connectivity to the edge. Its upside: no model
// to download, nothing sent anywhere, and it runs instantly.

import { loadImageSource } from "./convertImage";

const MAX_COLOR_DISTANCE = Math.sqrt(255 * 255 * 3); // ~441.67
const MAX_FEATHER_PX = 40; // feather=100 -> up to a 40px soft transition band

function colorDistance(r1, g1, b1, r2, g2, b2) {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/** Averages the four corner pixels as a best-guess background color. */
function sampleCornerColor(data, width, height) {
  const corners = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ];
  let r = 0;
  let g = 0;
  let b = 0;
  for (const [x, y] of corners) {
    const i = (y * width + x) * 4;
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
  }
  return { r: r / 4, g: g / 4, b: b / 4 };
}

/**
 * @param {File} file
 * @param {object} [options]
 * @param {number} [options.tolerance] 0..100 — how different a pixel's color can still be from the background and count as background
 * @param {number} [options.feather] 0..100 — width of the soft-alpha edge transition
 * @param {{x:number,y:number}|null} [options.samplePoint] normalized (0..1) point to sample the background color from; omit to auto-average the four corners
 * @param {(progress:number)=>void} [onProgress]
 * @returns {Promise<Blob>} a PNG with the background made transparent
 */
export async function removeBackground(file, options = {}, onProgress) {
  const { tolerance = 30, feather = 15, samplePoint = null } = options;
  onProgress?.(5);

  const source = await loadImageSource(file);
  const width = source.width || source.naturalWidth;
  const height = source.height || source.naturalHeight;
  if (!width || !height) {
    throw new Error("Gagal membaca dimensi gambar. File mungkin rusak atau formatnya tidak didukung browser.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, width, height);
  if (source.close) source.close();
  onProgress?.(15);

  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;

  const bg = samplePoint
    ? (() => {
        const x = Math.min(width - 1, Math.max(0, Math.round(samplePoint.x * width)));
        const y = Math.min(height - 1, Math.max(0, Math.round(samplePoint.y * height)));
        const i = (y * width + x) * 4;
        return { r: data[i], g: data[i + 1], b: data[i + 2] };
      })()
    : sampleCornerColor(data, width, height);

  const hardThreshold = (Math.max(0, Math.min(100, tolerance)) / 100) * MAX_COLOR_DISTANCE;
  const total = width * height;

  // --- Pass 1: flood fill from every edge pixel, only through pixels whose
  // color is within `hardThreshold` of the background color. Iterative
  // stack-based (not recursive) to avoid blowing the call stack on large images.
  const backgroundMask = new Uint8Array(total); // 1 = background
  const stack = new Int32Array(total);
  let sp = 0;

  const trySeed = (x, y) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const p = y * width + x;
    if (backgroundMask[p]) return;
    const i = p * 4;
    if (colorDistance(data[i], data[i + 1], data[i + 2], bg.r, bg.g, bg.b) <= hardThreshold) {
      backgroundMask[p] = 1;
      stack[sp++] = p;
    }
  };

  for (let x = 0; x < width; x += 1) {
    trySeed(x, 0);
    trySeed(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    trySeed(0, y);
    trySeed(width - 1, y);
  }
  onProgress?.(30);

  let processed = 0;
  while (sp > 0) {
    const p = stack[--sp];
    const x = p % width;
    const y = (p - x) / width;
    trySeed(x - 1, y);
    trySeed(x + 1, y);
    trySeed(x, y - 1);
    trySeed(x, y + 1);
    processed += 1;
    if (onProgress && processed % 300000 === 0) {
      onProgress(30 + Math.min(35, Math.round((processed / total) * 35)));
    }
  }
  onProgress?.(65);

  // --- Pass 2: feather the cutout edge with a multi-source BFS distance
  // transform, growing outward from the mask boundary up to `maxDist`
  // pixels. Alpha ramps from 0 (right at the mask) to 255 (maxDist away),
  // giving an anti-aliased edge instead of a hard cutout.
  const maxDist = Math.round((Math.max(0, Math.min(100, feather)) / 100) * MAX_FEATHER_PX);
  if (maxDist > 0) {
    const dist = new Int16Array(total).fill(-1);
    let qHead = 0;
    let qTail = 0;
    const queue = new Int32Array(total);
    for (let p = 0; p < total; p += 1) {
      if (backgroundMask[p]) {
        dist[p] = 0;
        queue[qTail++] = p;
      }
    }
    while (qHead < qTail) {
      const p = queue[qHead++];
      const d = dist[p];
      if (d >= maxDist) continue;
      const x = p % width;
      const y = (p - x) / width;
      const neighbors = [
        x > 0 ? p - 1 : -1,
        x < width - 1 ? p + 1 : -1,
        y > 0 ? p - width : -1,
        y < height - 1 ? p + width : -1,
      ];
      for (const np of neighbors) {
        if (np >= 0 && dist[np] === -1) {
          dist[np] = d + 1;
          queue[qTail++] = np;
        }
      }
    }
    for (let p = 0; p < total; p += 1) {
      if (backgroundMask[p]) {
        data[p * 4 + 3] = 0;
      } else if (dist[p] >= 0) {
        data[p * 4 + 3] = Math.round((dist[p] / maxDist) * 255);
      }
    }
  } else {
    for (let p = 0; p < total; p += 1) {
      if (backgroundMask[p]) data[p * 4 + 3] = 0;
    }
  }
  onProgress?.(92);

  ctx.putImageData(imageData, 0, 0);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Browser gagal membuat file gambar hasil."))),
      "image/png"
    );
  });
  onProgress?.(100);
  return blob;
}
