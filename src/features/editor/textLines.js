// Extracts the *real* text embedded in a PDF page, in the same top-down,
// unscaled-point coordinate space the editor's fabric canvas objects already
// use (origin top-left, y growing downward, 1 unit = 1pt @ zoom 1).
//
// Two views of the same data are returned:
//  - `flatItems`: one entry per pdf.js text item, in the exact order pdf.js
//    encountered them (i.e. content-stream execution order). This order is
//    what `pdfTextRedact.js` needs to line operators up 1:1 with items — do
//    NOT sort this array.
//  - `lines`: the items grouped by baseline proximity and sorted left-to-right
//    for display/editing, each carrying `itemIndices` pointing back into
//    `flatItems` so an edit can be traced back to the operators that drew it.
//
// Each item/line also carries its full PDF text-rendering matrix
// (`matrix`, the pdf.js `[a, b, c, d, e, f]` sextuple) and a derived
// `rotation` in degrees, so callers (pdfLineStyles.js, pdfTextRedact.js,
// pdfExport.js) can reproduce the original glyph placement — including
// rotated text — instead of only ever assuming horizontal text.

function itemFontSize(item) {
  const size = Math.hypot(item.transform[2], item.transform[3]);
  return Number.isFinite(size) && size > 0 ? size : 10;
}

/** Faux-italic / obliqued glyphs render through a sheared text matrix. */
function itemIsItalic(item) {
  const [, , c, d] = item.transform;
  if (!d) return false;
  return Math.abs(Math.atan2(c, d)) > 0.08; // ~4.6°, comfortably below real italic shear
}

/**
 * The text-space rotation baked into the item's rendering matrix, i.e. the
 * angle the glyph baseline makes with the horizontal. `transform` is the PDF
 * `[a, b, c, d, e, f]` matrix (pdf.js keeps the same convention as the
 * content stream's Tm × CTM), so the baseline direction is (a, b).
 */
function itemRotationDeg(item) {
  const [a, b] = item.transform;
  if (!a && !b) return 0;
  const deg = (Math.atan2(b, a) * 180) / Math.PI;
  return ((deg % 360) + 360) % 360;
}

const ROTATION_EPSILON_DEG = 0.5;
function isRotated(deg) {
  return deg > ROTATION_EPSILON_DEG && deg < 360 - ROTATION_EPSILON_DEG;
}

/**
 * Axis-aligned canvas-space bounding box for a single item, computed by
 * rotating its local glyph box (baseline-relative) through the item's own
 * matrix. Used for rotated text, where the plain "baseline row" box the
 * unrotated path uses would be wrong. The box is a safe superset (it fully
 * contains the rotated glyphs) rather than a tight rotated rectangle, since
 * downstream consumers (hit-testing, the edit mask) work in axis-aligned
 * canvas space.
 */
function rotatedItemBoxCanvas(item, pageHeight, fontSize) {
  const [a, b, c, d, e, f] = item.transform;
  const width = item.width || fontSize * 0.5 * item.str.length;
  const ascent = fontSize * 0.82;
  const descent = fontSize * 0.25;
  const corners = [
    [0, -descent],
    [width, -descent],
    [width, ascent],
    [0, ascent],
  ];
  let minX = Infinity;
  let maxX = -Infinity;
  let minYpdf = Infinity;
  let maxYpdf = -Infinity;
  corners.forEach(([lx, ly]) => {
    const px = a * lx + c * ly + e;
    const py = b * lx + d * ly + f;
    minX = Math.min(minX, px);
    maxX = Math.max(maxX, px);
    minYpdf = Math.min(minYpdf, py);
    maxYpdf = Math.max(maxYpdf, py);
  });
  const top = pageHeight - maxYpdf;
  const bottom = pageHeight - minYpdf;
  return { left: minX, top, width: Math.max(maxX - minX, 1), height: Math.max(bottom - top, 1) };
}

/**
 * @param {import('pdfjs-dist').PDFPageProxy} page
 */
export async function extractPageTextLines(page) {
  const [content, viewport] = [await page.getTextContent(), page.getViewport({ scale: 1 })];
  const pageHeight = viewport.height;

  const rawItems = content.items.filter((it) => it.str && it.str.trim().length > 0);

  const flatItems = rawItems.map((it) => {
    const fontSize = itemFontSize(it);
    return {
      text: it.str,
      left: it.transform[4],
      baselineY: it.transform[5],
      width: it.width || fontSize * 0.5 * it.str.length,
      fontSize,
      italic: itemIsItalic(it),
      rotation: itemRotationDeg(it),
      matrix: it.transform.slice(),
    };
  });

  // Group into visual lines by baseline proximity, preserving each item's
  // index into `flatItems` (execution order) rather than the sorted order.
  // Rotated items are never merged with neighbours — grouping by baseline-Y
  // only makes sense for horizontal text, since a rotated line's Y changes
  // glyph to glyph. Each rotated item becomes its own single-item line,
  // which stays correct (if occasionally coarser-grained) rather than ever
  // merging unrelated rotated runs into one bogus line.
  const groups = [];
  let current = null;
  let currentY = null;
  flatItems.forEach((item, index) => {
    if (isRotated(item.rotation)) {
      if (current) {
        groups.push(current);
        current = null;
        currentY = null;
      }
      groups.push([index]);
      return;
    }
    if (currentY === null || Math.abs(item.baselineY - currentY) > 4) {
      if (current) groups.push(current);
      current = [index];
      currentY = item.baselineY;
    } else {
      current.push(index);
    }
  });
  if (current) groups.push(current);

  const lines = groups.map((itemIndices) => {
    const sortedIndices = [...itemIndices].sort((a, b) => flatItems[a].left - flatItems[b].left);
    const sortedItems = sortedIndices.map((i) => flatItems[i]);
    const text = sortedItems.map((it) => it.text).join("");
    const fontSize = Math.max(...sortedItems.map((it) => it.fontSize));
    const italic = sortedItems.some((it) => it.italic);
    const rotation = sortedItems[0].rotation;
    const matrix = sortedItems[0].matrix;
    const x0 = sortedItems[0].left;
    const last = sortedItems[sortedItems.length - 1];
    const xEnd = last.left + last.width;
    const baselineY = sortedItems[0].baselineY;

    let box;
    if (isRotated(rotation)) {
      // Single-item line (see grouping above) — use its true rotated box.
      box = rotatedItemBoxCanvas(sortedItems[0], pageHeight, fontSize);
    } else {
      // pdf.js's y is the glyph baseline, measured bottom-up from the
      // page's bottom edge. Flip it into the canvas's top-down space and
      // pad a bit above the baseline so ascenders/descenders are covered.
      const top = pageHeight - baselineY - fontSize * 0.82;
      const height = fontSize * 1.25;
      box = { left: x0, top, width: Math.max(xEnd - x0, fontSize * 0.6), height };
    }

    return {
      text,
      left: box.left,
      top: box.top,
      width: box.width,
      height: box.height,
      fontSize,
      italic,
      rotation, // degrees, PDF convention (counter-clockwise from horizontal)
      matrix, // [a, b, c, d, e, f] of the line's first item, PDF text space
      baselineX: x0,
      baselineY, // bottom-up PDF space, ready for pdf-lib's drawText
      itemIndices, // NOT sorted — matches flatItems order, needed for redaction
    };
  });

  // Second pass: prevent adjacent lines' hit boxes from overlapping. With
  // the box formula above (padding above the baseline for ascenders/
  // descenders) tightly-spaced lines — common in dense documents like
  // resumes — can end up with boxes that overlap a few points into their
  // neighbour. A click near that boundary would then resolve to the wrong
  // line, and in the editor that means a second, overlapping edit object
  // gets created instead of the existing one being reopened. Clip each
  // pair of vertically-overlapping, horizontally-overlapping (i.e. actually
  // stacked, not side-by-side) lines at their midpoint so every point on
  // the page maps to at most one line.
  const stackable = lines.filter((l) => !isRotated(l.rotation));
  const byTop = [...stackable].sort((a, b) => a.top - b.top);
  for (let i = 0; i < byTop.length - 1; i++) {
    const a = byTop[i];
    const b = byTop[i + 1];
    const overlap = a.top + a.height - b.top;
    if (overlap <= 0) continue;
    const horizontallyOverlaps = a.left < b.left + b.width && b.left < a.left + a.width;
    if (!horizontallyOverlaps) continue;
    const mid = b.top + overlap / 2;
    a.height = Math.max(mid - a.top, 2);
    b.height = Math.max(b.top + b.height - mid, 2);
    b.top = mid;
  }

  return {
    lines,
    flatItems: flatItems.map(({ text, rotation, matrix }) => ({ text, rotation, matrix })),
  };
}
