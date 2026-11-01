import { PDFDocument, StandardFonts, degrees, rgb } from "@cantoo/pdf-lib";
import { StaticCanvas } from "fabric";
import { extractPageTextLines } from "./textLines";
import { planRedaction, applyRedactions, writePageOperations, guessStandardFont } from "./pdfTextRedact";
import { wrapTextToWidth } from "./textWrap";

const OVERLAY_MULTIPLIER = 2;

/** Rasterize a (already object-filtered) fabric canvas JSON to a transparent PNG data URL. */
async function rasterizeAnnotations(jsonObj, widthPt, heightPt) {
  if (!jsonObj || !jsonObj.objects || jsonObj.objects.length === 0) return null;
  const el = document.createElement("canvas");
  el.width = widthPt;
  el.height = heightPt;
  const staticCanvas = new StaticCanvas(el, {
    width: widthPt,
    height: heightPt,
    backgroundColor: "transparent",
  });
  await staticCanvas.loadFromJSON(jsonObj);
  staticCanvas.renderAll();
  const dataUrl = staticCanvas.toDataURL({
    format: "png",
    multiplier: OVERLAY_MULTIPLIER,
  });
  staticCanvas.dispose();
  return dataUrl;
}

function hexToRgbFloats(hex) {
  const clean = (hex || "#000000").replace("#", "");
  const num = parseInt(clean.length === 3 ? clean.replace(/./g, (c) => c + c) : clean, 16);
  return rgb(((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255);
}

/**
 * Draw text honoring non-default character spacing (PDF `Tc`), word spacing
 * (`Tw`) and horizontal scaling (`Tz`), and/or a baseline rotation — none of
 * which pdf-lib's `page.drawText` applies on its own beyond simple rotation.
 * Falls back internally to a single `drawText` call (byte-for-byte the same
 * output as before this change) whenever every one of those is at its PDF
 * default, so the common case is untouched.
 */
function drawTextStyled(page, text, { x, y, size, font, color, opacity, rotationDeg = 0, charSpacing = 0, wordSpacing = 0, hScale = 100 }) {
  const isDefaultSpacing = Math.abs(charSpacing) < 0.01 && Math.abs(wordSpacing) < 0.01 && Math.abs(hScale - 100) < 0.5;
  if (isDefaultSpacing) {
    const opts = { x, y, size, font, color, opacity };
    if (Math.abs(rotationDeg) > 0.01) opts.rotate = degrees(rotationDeg);
    page.drawText(text, opts);
    return;
  }

  const rad = (rotationDeg * Math.PI) / 180;
  const dirX = Math.cos(rad);
  const dirY = Math.sin(rad);
  const scale = hScale / 100;
  let penX = x;
  let penY = y;
  const rotateOpt = Math.abs(rotationDeg) > 0.01 ? { rotate: degrees(rotationDeg) } : {};

  for (const ch of Array.from(text)) {
    page.drawText(ch, { x: penX, y: penY, size, font, color, opacity, ...rotateOpt });
    const glyphWidth = font.widthOfTextAtSize(ch, size) * scale;
    const extra = (ch === " " ? wordSpacing : 0) + charSpacing;
    const advance = glyphWidth + extra;
    penX += advance * dirX;
    penY += advance * dirY;
  }
}

function standardFontFor({ family, bold, italic }) {
  if (family === "times") {
    if (bold && italic) return StandardFonts.TimesRomanBoldItalic;
    if (bold) return StandardFonts.TimesRomanBold;
    if (italic) return StandardFonts.TimesRomanItalic;
    return StandardFonts.TimesRoman;
  }
  if (family === "courier") {
    if (bold && italic) return StandardFonts.CourierBoldOblique;
    if (bold) return StandardFonts.CourierBold;
    if (italic) return StandardFonts.CourierOblique;
    return StandardFonts.Courier;
  }
  if (bold && italic) return StandardFonts.HelveticaBoldOblique;
  if (bold) return StandardFonts.HelveticaBold;
  if (italic) return StandardFonts.HelveticaOblique;
  return StandardFonts.Helvetica;
}

/** Lazily embeds (and caches) the 4 Helvetica/Times/Courier weight variants actually used. */
function makeFontCache(outDoc) {
  const cache = new Map();
  return async (guess) => {
    const key = standardFontFor(guess);
    if (!cache.has(key)) cache.set(key, outDoc.embedFont(key));
    return cache.get(key);
  };
}

/**
 * Edits to *original* PDF text are tagged `isTextEdit`/`lineIndex` by
 * PdfCanvas.jsx. Split a page's fabric objects into that group (grouped back
 * per edited line) and everything else (shapes, free text, images,
 * highlights, signature, drawing) which still goes through the ordinary
 * raster-overlay path — that part of the tool was never the complaint.
 */
function partitionTextEdits(objects) {
  const others = [];
  const byLine = new Map();
  (objects || []).forEach((obj) => {
    if (!obj.isTextEdit) {
      others.push(obj);
      return;
    }
    const arr = byLine.get(obj.lineIndex) || [];
    arr.push(obj);
    byLine.set(obj.lineIndex, arr);
  });
  return { others, byLine };
}

/**
 * A user-added text box (the "Tambah Teks" tool — a word-wrapping
 * `Textbox`) can be drawn as real PDF text instead of getting rasterized
 * with everything else, as long as its geometry maps cleanly onto pdf-lib's
 * `drawText`: no rotation, uniform scale, no per-character spacing tweak, no
 * highlight-behind-text fill. Anything outside that stays on the raster path
 * — never guessed, just falls back like the rest of this file does.
 */
function isVectorizableAddedText(obj) {
  if (!obj || obj.isTextEdit || !["IText", "Textbox"].includes(obj.type)) return false;
  if (!obj.text || !obj.text.trim()) return false;
  if (obj.linethrough || obj.textBackgroundColor) return false;
  if (obj.charSpacing) return false;
  const angle = (((obj.angle || 0) % 360) + 360) % 360;
  if (!(angle < 0.5 || angle > 359.5)) return false;
  const sx = obj.scaleX ?? 1;
  const sy = obj.scaleY ?? 1;
  if (Math.abs(sx - sy) > 0.02 * Math.max(sx, sy, 1)) return false;
  return true;
}

/**
 * Pull vectorizable text objects out of `others`, but only when nothing
 * that must stay rasterized sits *above* them in the original stacking
 * order — otherwise drawing "raster layer, then vector text on top" would
 * silently reorder them in front of something the user put over them.
 */
function partitionAddedText(objects) {
  const list = objects || [];
  const vectorSet = new Set();
  let sawRasterAfter = false;
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const obj = list[i];
    if (!sawRasterAfter && isVectorizableAddedText(obj)) {
      vectorSet.add(obj);
    } else {
      sawRasterAfter = true;
    }
  }
  const vector = [];
  const raster = [];
  list.forEach((obj) => (vectorSet.has(obj) ? vector.push(obj) : raster.push(obj)));
  return { vector, raster };
}

/**
 * Greedy word-wrap matching how fabric's Textbox breaks lines — see
 * ./textWrap.js for the implementation and rationale (kept in its own
 * dependency-free file so it's easy to unit test).
 */
function guessAddedTextFont(obj) {
  const fam = (obj.fontFamily || "").toLowerCase();
  const family = fam.includes("times") || fam.includes("serif")
    ? "times"
    : fam.includes("courier") || fam.includes("mono")
    ? "courier"
    : "helvetica";
  const weight = obj.fontWeight;
  const bold = weight === "bold" || weight === "bolder" || (typeof weight === "number" && weight >= 600);
  const italic = obj.fontStyle === "italic" || obj.fontStyle === "oblique";
  return { family, bold, italic };
}

/** Draw one user-added text box as real vector PDF text (see `isVectorizableAddedText`). */
async function drawVectorAddedText(page, obj, fontCache, pageHeightPt) {
  const font = await fontCache(guessAddedTextFont(obj));
  const scale = obj.scaleY ?? obj.scaleX ?? 1;
  const fontSize = (obj.fontSize || 16) * scale;
  const lineHeightPt = fontSize * (obj.lineHeight || 1.16);
  const blockWidth = (obj.width || 0) * (obj.scaleX ?? scale);
  const color = hexToRgbFloats(typeof obj.fill === "string" ? obj.fill : "#000000");
  const opacity = obj.opacity == null ? 1 : obj.opacity;
  const align = obj.textAlign || "left";
  // Approximate offset from fabric's "top" of the text block to the first
  // line's baseline — fabric's line box includes some leading above the
  // glyphs, same rough approximation used for original-text edits.
  const baselineOffset = fontSize * 0.88;

  const lines = wrapTextToWidth(obj.text, font, fontSize, blockWidth);
  lines.forEach((lineText, idx) => {
      const lineWidth = font.widthOfTextAtSize(lineText, fontSize);
      let x = obj.left || 0;
      if (align === "center") x += (blockWidth - lineWidth) / 2;
      else if (align === "right") x += blockWidth - lineWidth;
      const topY = (obj.top || 0) + idx * lineHeightPt + baselineOffset;
      const y = pageHeightPt - topY;
      page.drawText(lineText, { x, y, size: fontSize, font, color, opacity });
      if (obj.underline && lineText) {
        const underlineY = y - fontSize * 0.12;
        page.drawLine({
          start: { x, y: underlineY },
          end: { x: x + lineWidth, y: underlineY },
          thickness: Math.max(0.5, fontSize * 0.05),
          color,
          opacity,
        });
      }
    });
}

/**
 * Render a page once (at scale 1, same space `textLines.js` boxes are in)
 * and sample the row just above a given line's box — same technique
 * `PdfCanvas.jsx` uses for its live-editing patch. Used as a belt-and-
 * suspenders background cover drawn behind every redacted line's
 * replacement text: content-stream redaction (`redactOperators`) *should*
 * fully erase the original glyphs, but a handful of real-world PDFs (an
 * unmapped ligature, a glyph drawn by a second, overlapping operator our
 * matching didn't account for, a clipped/duplicated decorative run) can
 * leave a sliver of the old glyphs behind. Painting a matching-colour
 * rectangle first means a leftover sliver is invisible instead of showing
 * through as "double text" — it costs nothing when redaction was already
 * complete (the rectangle just repaints already-blank page background).
 */
async function makeLineBackgroundSampler(pdfjsPage) {
  try {
    const viewport = pdfjsPage.getViewport({ scale: 1 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    const ctx = canvas.getContext("2d");
    await pdfjsPage.render({ canvasContext: ctx, viewport }).promise;
    return (line) => {
      try {
        const x = Math.max(0, Math.round(line.left));
        const y = Math.max(0, Math.round(line.top - 2));
        const w = Math.min(Math.max(1, Math.round(line.width)), canvas.width - x);
        if (w <= 0 || y >= canvas.height) return { r: 1, g: 1, b: 1 };
        const { data } = ctx.getImageData(x, y, w, 1);
        let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < data.length; i += 4) {
          r += data[i]; g += data[i + 1]; b += data[i + 2]; n += 1;
        }
        if (n === 0) return { r: 1, g: 1, b: 1 };
        return { r: r / n / 255, g: g / n / 255, b: b / n / 255 };
      } catch {
        return { r: 1, g: 1, b: 1 };
      }
    };
  } catch {
    return () => ({ r: 1, g: 1, b: 1 });
  }
}

/**
 * Apply true text edits to one source page: try to erase the original
 * glyphs from the content stream and draw the replacement as real vector
 * text. Whatever can't be safely redacted (unsupported PDF structure, or a
 * line whose removal would shift unrelated text) is left in `others` so it
 * still gets the old raster-patch treatment — never silently dropped.
 */
async function applyTextEdits({ page, pdfjsPage, byLine, others, fontCache, pageHeightPt }) {
  if (byLine.size === 0) return;

  const { lines, flatItems } = await extractPageTextLines(pdfjsPage);
  const editedLineIndices = [...byLine.keys()].filter((i) => lines[i]);

  const plan = planRedaction({ pdfLibPage: page, flatItems, lines, editedLineIndices });

  editedLineIndices.forEach((lineIndex) => {
    if (!plan.supported || !plan.safeLineIndices.has(lineIndex)) {
      // Can't safely redact — fall back to the raster patch for this line only.
      others.push(...byLine.get(lineIndex));
    }
  });

  if (!plan.supported) return;

  applyRedactions(plan, lines, editedLineIndices);
  writePageOperations(page, plan.operations);

  const safeLinesNeedingCover = editedLineIndices.filter((i) => plan.safeLineIndices.has(i));
  const sampleBg = safeLinesNeedingCover.length > 0 ? await makeLineBackgroundSampler(pdfjsPage) : null;

  for (const lineIndex of editedLineIndices) {
    if (!plan.safeLineIndices.has(lineIndex)) continue;
    const lineObjs = byLine.get(lineIndex);
    const textObj = lineObjs.find((o) => o.type === "IText" || o.type === "Textbox");
    const newText = (textObj?.text || "").trim();

    const line = lines[lineIndex];

    // Cover the original glyphs' box before drawing anything (or nothing,
    // for a deletion) — see makeLineBackgroundSampler's doc comment above.
    if (sampleBg) {
      const bg = sampleBg(line);
      page.drawRectangle({
        x: line.left - 1,
        y: pageHeightPt - (line.top + line.height) - 1,
        width: line.width + 2,
        height: line.height + 2,
        color: rgb(bg.r, bg.g, bg.b),
      });
    }

    if (!newText) continue; // deletion: nothing more to draw
    const info = plan.lineInfo.get(lineIndex) || {};
    // Prefer the *edited* object's own styling (set via the Bold/Italic/
    // Underline/colour controls) over the original line's guessed font —
    // otherwise formatting changes made in the editor would silently vanish
    // on export even though they're visible on screen.
    const objBold = textObj.fontWeight === "bold" || textObj.fontWeight === "bolder" || Number(textObj.fontWeight) >= 600;
    const objItalic = textObj.fontStyle === "italic" || textObj.fontStyle === "oblique";
    const guess = guessStandardFont(info.fontBaseName, objItalic || line.italic || info.italic, info.bold);
    guess.bold = objBold || guess.bold;
    guess.italic = objItalic || guess.italic;
    const font = await fontCache(guess);
    const fontSize = textObj.fontSize || line.fontSize;
    const color = hexToRgbFloats(typeof textObj.fill === "string" ? textObj.fill : info.color);
    // Original character/word spacing and horizontal scaling (PDF Tc/Tw/Tz)
    // — carried over so a spaced-out heading or condensed caption keeps its
    // look instead of silently reverting to PDF's tight defaults.
    const charSpacing = info.charSpacing || 0;
    const wordSpacing = info.wordSpacing || 0;
    const hScale = info.hScale ?? 100;
    // A rotated line (line.rotation != 0, from textLines.js) is a single
    // pdf.js item by construction — draw it as one un-wrapped run along its
    // original baseline direction rather than the horizontal multi-line
    // wrap below, which assumes a left-to-right, top-to-bottom layout that
    // doesn't apply once the text runs diagonally or vertically.
    const rotationDeg = line.rotation || 0;
    const isRotatedLine = Math.abs(rotationDeg) > 0.5 && Math.abs(rotationDeg - 360) > 0.5;

    if (isRotatedLine) {
      const singleLineText = textObj.text.replace(/\n/g, " ");
      if (singleLineText) {
        drawTextStyled(page, singleLineText, {
          x: line.baselineX,
          y: line.baselineY,
          size: fontSize,
          font,
          color,
          rotationDeg,
          charSpacing,
          wordSpacing,
          hScale,
        });
      }
      continue; // eslint-disable-line no-continue -- next edited line, not done with the page
    }

    // Word-style WYSIWYG export: `textObj.left/top` is where the box
    // actually sits on screen *right now* — the user may have dragged or
    // resized it after typing. `origLeft/origTop` (set once, at creation,
    // in PdfCanvas.jsx's createLineEditObjects) is where it started, which
    // is exactly where `line.left`/`line.baselineY` (from the freshly
    // re-extracted original PDF geometry) point to. Anchoring on the delta
    // between "now" and "then" — rather than on `line.left`/`baselineY`
    // directly — keeps pixel-perfect precision for the untouched, by far
    // most common case (delta is 0) while still following the box to its
    // new spot when it *has* been moved, instead of silently snapping every
    // edited line back to its original position on export.
    const scale = textObj.scaleY ?? textObj.scaleX ?? 1;
    const effectiveFontSize = fontSize * scale;
    const dxPt = (textObj.left ?? line.left) - (textObj.origLeft ?? line.left);
    const dyPt = (textObj.top ?? line.top) - (textObj.origTop ?? line.top);
    const anchorLeft = line.left + dxPt;
    const anchorBaselineY = line.baselineY - dyPt;

    // `textObj.width` is the Textbox's wrap width (see PdfCanvas.jsx's
    // createLineEditObjects) — wrap the replacement the same way it wraps
    // on screen, otherwise a reflowed multi-line edit would get flattened
    // back onto one line running off the page in the exported PDF.
    const maxWidth = textObj.type === "Textbox" ? (textObj.width || 0) * (textObj.scaleX ?? scale) : 0;
    const wrappedLines = wrapTextToWidth(textObj.text, font, effectiveFontSize, maxWidth);
    const lineHeightPt = effectiveFontSize * (textObj.lineHeight || 1.16);
    const align = textObj.textAlign || "left";
    const highlightColor =
      typeof textObj.textBackgroundColor === "string" && textObj.textBackgroundColor
        ? hexToRgbFloats(textObj.textBackgroundColor)
        : null;
    wrappedLines.forEach((lineText, idx) => {
      if (!lineText) return;
      const lineWidth = font.widthOfTextAtSize(lineText, effectiveFontSize) * (hScale / 100);
      let x = anchorLeft;
      if (maxWidth > 0 && align === "center") x += (maxWidth - lineWidth) / 2;
      else if (maxWidth > 0 && align === "right") x += maxWidth - lineWidth;
      const y = anchorBaselineY - idx * lineHeightPt;
      // Word's text-highlight look: a solid fill behind the glyphs, drawn
      // before the text so the ink stays on top.
      if (highlightColor) {
        page.drawRectangle({
          x: x - 1,
          y: y - effectiveFontSize * 0.25,
          width: lineWidth + 2,
          height: effectiveFontSize * 1.15,
          color: highlightColor,
        });
      }
      drawTextStyled(page, lineText, { x, y, size: effectiveFontSize, font, color, charSpacing, wordSpacing, hScale });
      if (textObj.underline) {
        const underlineY = y - effectiveFontSize * 0.12;
        page.drawLine({
          start: { x, y: underlineY },
          end: { x: x + lineWidth, y: underlineY },
          thickness: Math.max(0.5, effectiveFontSize * 0.05),
          color,
        });
      }
      if (textObj.linethrough) {
        const strikeY = y + effectiveFontSize * 0.28;
        page.drawLine({
          start: { x, y: strikeY },
          end: { x: x + lineWidth, y: strikeY },
          thickness: Math.max(0.5, effectiveFontSize * 0.05),
          color,
        });
      }
    });
  }
}

/**
 * @param {object} params
 * @param {File} params.originalFile
 * @param {import('pdfjs-dist').PDFDocumentProxy} [params.pdfDoc] needed to truly redact/redraw edited text
 * @param {Array} params.pages editor store pages
 * @param {Record<string,string>} params.canvasJSON pageId -> fabric json
 * @param {(progress:number)=>void} params.onProgress
 */
export async function exportEditedPdf({ originalFile, pdfDoc, pages, canvasJSON, onProgress }) {
  const sourceBytes = await originalFile.arrayBuffer();
  const sourceDoc = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
  const out = await PDFDocument.create();
  const fontCache = makeFontCache(out);

  for (let i = 0; i < pages.length; i += 1) {
    const pageMeta = pages[i];
    let page;

    if (pageMeta.kind === "source") {
      const [copied] = await out.copyPages(sourceDoc, [pageMeta.sourceIndex]);
      page = out.addPage(copied);
    } else {
      page = out.addPage([pageMeta.widthPt, pageMeta.heightPt]);
    }

    const json = canvasJSON[pageMeta.id] ? JSON.parse(canvasJSON[pageMeta.id]) : null;
    const { others, byLine } = partitionTextEdits(json?.objects);

    if (pageMeta.kind === "source" && byLine.size > 0 && pdfDoc) {
      const pdfjsPage = await pdfDoc.getPage(pageMeta.sourceIndex + 1);
      await applyTextEdits({ page, pdfjsPage, byLine, others, fontCache, pageHeightPt: pageMeta.heightPt });
    } else if (byLine.size > 0) {
      // No pdfDoc available or a blank page with tagged objects somehow —
      // never drop edits, just fall back to rasterizing them like before.
      byLine.forEach((objs) => others.push(...objs));
    }

    const { vector, raster } = partitionAddedText(others);

    const overlayDataUrl = await rasterizeAnnotations(
      json ? { ...json, objects: raster } : null,
      pageMeta.widthPt,
      pageMeta.heightPt
    );
    if (overlayDataUrl) {
      const overlayBytes = await (await fetch(overlayDataUrl)).arrayBuffer();
      const overlayImage = await out.embedPng(overlayBytes);
      page.drawImage(overlayImage, {
        x: 0,
        y: 0,
        width: pageMeta.widthPt,
        height: pageMeta.heightPt,
      });
    }

    // Draw vectorizable added text *after* the raster overlay so it lands on
    // top — correct as long as `partitionAddedText` only vectorized text
    // that had nothing raster stacked above it to begin with.
    for (const obj of vector) {
      // eslint-disable-next-line no-await-in-loop
      await drawVectorAddedText(page, obj, fontCache, pageMeta.heightPt);
    }

    if (pageMeta.rotation) {
      const base = page.getRotation().angle;
      page.setRotation(degrees((base + pageMeta.rotation) % 360));
    }

    onProgress?.(Math.round(((i + 1) / pages.length) * 90));
  }

  const bytes = await out.save();
  onProgress?.(100);
  return new Blob([bytes], { type: "application/pdf" });
}
