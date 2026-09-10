import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  PageBreak,
  HeadingLevel,
  AlignmentType,
  TabStopType,
} from "docx";
import { OPS } from "pdfjs-dist";
import { loadPdfDocument } from "../../lib/pdfjs";
import { convertViaBackend, BackendUnavailableError } from "./backendConvert";

const MIN_FONT_PT = 6;
const MAX_FONT_PT = 72;
const DEFAULT_FONT_PT = 11;
const MAX_IMAGE_WIDTH_PT = 460; // keeps embedded images within a normal page's text width
const DEFAULT_MARGIN_PT = 72; // matches docx's default 1" section margin
// Besides the common Unicode bullets, PDFs exported from Word/LibreOffice
// frequently render list bullets using a Wingdings/Symbol private-use glyph
// (U+F0A7, U+F0B7, U+F0D8, ...) rather than a real "•" character. Without
// matching those, bulleted lists silently degrade into plain merged text.
const BULLET_RE = /^\s*([•\-*▪◦‣∙○●■□\uF06E\uF0A7\uF0B7\uF0D8\uF0A8])\s+/;
// A gap this wide inside one visual line is treated as a tab jump (e.g. a
// job title on the left and a date range on the right of the same line)
// rather than ordinary word spacing.
const COLUMN_GAP_RATIO = 0.12;

function clampFontPt(pt) {
  if (!Number.isFinite(pt) || pt <= 0) return DEFAULT_FONT_PT;
  return Math.min(MAX_FONT_PT, Math.max(MIN_FONT_PT, pt));
}

/** Estimate a text item's font size (pt) from its transform matrix. */
function itemFontSize(item) {
  return clampFontPt(Math.hypot(item.transform[2], item.transform[3]));
}

/**
 * Build a fontName -> {bold, italic} lookup for a page. pdf.js only resolves
 * a font's real name/flags in `page.commonObjs` after its content stream has
 * been parsed (getOperatorList), so the caller must await that first. Falls
 * back to the generic CSS family from getTextContent()'s `styles` map (e.g.
 * "sans-serif") when a font can't be resolved.
 */
function buildFontStyleLookup(page, styles) {
  const cache = new Map();
  return (fontName) => {
    if (cache.has(fontName)) return cache.get(fontName);
    let style;
    try {
      const font = page.commonObjs.get(fontName);
      const name = `${font?.name || ""} ${font?.fallbackName || ""}`;
      style = {
        bold: !!font?.bold || /bold|black|heavy|semibold/i.test(name),
        italic: !!font?.italic || /italic|oblique/i.test(name),
      };
    } catch {
      const family = styles?.[fontName]?.fontFamily || "";
      style = {
        bold: /bold|black|heavy|semibold/i.test(family),
        italic: /italic|oblique/i.test(family),
      };
    }
    cache.set(fontName, style);
    return style;
  };
}

/**
 * Group pdf.js text items into visual lines (by y-position), ordered left to
 * right, and collapse same-style runs of text together.
 */
function groupIntoLines(items, getStyle, pageWidth) {
  const filtered = items.filter((it) => it.str && it.str.trim().length > 0);
  const lines = [];
  let currentY = null;
  let current = [];

  filtered.forEach((item) => {
    const y = item.transform[5];
    if (currentY === null || Math.abs(y - currentY) > 4) {
      if (current.length) lines.push(current);
      current = [item];
      currentY = y;
    } else {
      current.push(item);
    }
  });
  if (current.length) lines.push(current);

  const columnGapPt = (pageWidth || 612) * COLUMN_GAP_RATIO;

  return lines.map((lineItems) => {
    const sorted = [...lineItems].sort((a, b) => a.transform[4] - b.transform[4]);
    const runs = [];
    let hasTab = false;

    sorted.forEach((item, idx) => {
      const { bold, italic } = getStyle(item.fontName);
      const sizePt = itemFontSize(item);
      let text = item.str;
      let isTab = false;

      if (idx > 0) {
        const prev = sorted[idx - 1];
        const prevEnd = prev.transform[4] + (prev.width || 0);
        const gap = item.transform[4] - prevEnd;
        if (gap > columnGapPt) {
          // A wide jump within the same baseline — e.g. "Job Title" ... far
          // right ... "2024 - 2025". Preserve it as a real tab instead of
          // silently mashing the two halves together with one space.
          text = `\t${text}`;
          isTab = true;
          hasTab = true;
        } else if (gap > sizePt * 0.2 && !/^\s/.test(text) && !/\s$/.test(prev.str)) {
          // pdf.js sometimes splits words into separate items without a
          // literal space char between them — insert one when there's a
          // visible (but ordinary) gap.
          text = ` ${text}`;
        }
      }

      const last = runs[runs.length - 1];
      if (!isTab && last && last.bold === bold && last.italic === italic && Math.abs(last.sizePt - sizePt) < 0.5) {
        last.text += text;
      } else {
        runs.push({ text, bold, italic, sizePt });
      }
    });

    const first = sorted[0];
    const lastItem = sorted[sorted.length - 1];
    return {
      runs,
      hasTab,
      y: first.transform[5],
      x0: first.transform[4],
      xEnd: lastItem.transform[4] + (lastItem.width || 0),
      maxSizePt: Math.max(...runs.map((r) => r.sizePt)),
    };
  });
}

function median(values) {
  if (values.length === 0) return DEFAULT_FONT_PT;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Classify a line as a heading based on how much bigger it is than body text. */
function headingLevelFor(maxSizePt, bodySizePt) {
  const ratio = maxSizePt / bodySizePt;
  if (ratio >= 1.45) return HeadingLevel.HEADING_1;
  if (ratio >= 1.2) return HeadingLevel.HEADING_2;
  // Section headers in real documents (CVs, reports) are very often just a
  // notch above body text — e.g. 12pt headers over 10.5pt body is a ratio of
  // only ~1.14 — so the old 1.15 floor missed the single most common case.
  if (ratio >= 1.08) return HeadingLevel.HEADING_3;
  return null;
}

/** Guess left/center/right alignment from where the line sits on the page. */
function alignmentFor(x0, xEnd, pageWidth) {
  if (!pageWidth) return AlignmentType.LEFT;
  const leftMargin = x0;
  const rightMargin = pageWidth - xEnd;
  const lineWidth = xEnd - x0;

  if (leftMargin > pageWidth * 0.15 && Math.abs(leftMargin - rightMargin) < pageWidth * 0.08) {
    return AlignmentType.CENTER;
  }
  if (leftMargin > pageWidth * 0.4 && rightMargin < pageWidth * 0.08 && lineWidth < pageWidth * 0.5) {
    return AlignmentType.RIGHT;
  }
  return AlignmentType.LEFT;
}

/**
 * Collapse consecutive PDF lines that clearly belong to the same flowing
 * paragraph (similar left edge, normal line spacing, not a heading/bullet)
 * into a single group, so wrapped sentences read as one Word paragraph
 * instead of breaking after every PDF line.
 */
function buildParagraphGroups(lines, bodySizePt) {
  const groups = [];
  let current = null;
  let prevLine = null;

  lines.forEach((line) => {
    const text = line.runs.map((r) => r.text).join("");
    const headingLevel = headingLevelFor(line.maxSizePt, bodySizePt);
    const bulleted = BULLET_RE.test(text);
    const gap = prevLine ? prevLine.y - line.y : 0;
    const bigGap = prevLine !== null && gap > line.maxSizePt * 1.9;
    const indentChange =
      prevLine !== null && !bulleted && Math.abs(line.x0 - prevLine.x0) > line.maxSizePt * 1.5;
    const prevWasHeading = prevLine ? headingLevelFor(prevLine.maxSizePt, bodySizePt) : null;

    const prevHadTab = prevLine ? prevLine.hasTab : false;
    const startsNew =
      !current || headingLevel || bulleted || bigGap || indentChange || prevWasHeading || line.hasTab || prevHadTab;

    if (startsNew) {
      if (current) groups.push(current);
      current = { lines: [line], headingLevel, bulleted, hasTab: line.hasTab, extraBefore: bigGap ? 160 : 0 };
    } else {
      current.lines.push(line);
    }
    prevLine = line;
  });
  if (current) groups.push(current);
  return groups;
}

function groupToParagraph(group, pageWidth) {
  const allRuns = [];
  group.lines.forEach((line, li) => {
    line.runs.forEach((r, ri) => {
      let text = r.text;
      const last = allRuns[allRuns.length - 1];
      const isTabRun = text.startsWith("\t");
      if (li > 0 && ri === 0 && !isTabRun && !/^\s/.test(text) && !(last && /\s$/.test(last.text))) {
        text = ` ${text}`; // joining two PDF lines into one flowing paragraph
      }
      if (!isTabRun && last && last.bold === r.bold && last.italic === r.italic && Math.abs(last.sizePt - r.sizePt) < 0.5) {
        last.text += text;
      } else {
        allRuns.push({ ...r, text });
      }
    });
  });

  if (group.bulleted && allRuns.length > 0) {
    allRuns[0].text = allRuns[0].text.replace(BULLET_RE, "");
  }

  const first = group.lines[0];
  const alignment = group.hasTab ? AlignmentType.LEFT : alignmentFor(first.x0, first.xEnd, pageWidth);
  const children = allRuns.map(
    (r) =>
      new TextRun({
        text: r.text,
        bold: r.bold,
        italics: r.italic,
        size: Math.round(r.sizePt * 2), // docx sizes are in half-points
      })
  );

  const usableWidthPt = Math.max(pageWidth - 2 * DEFAULT_MARGIN_PT, 100);
  const tabStops = group.hasTab
    ? [{ type: TabStopType.RIGHT, position: Math.round(usableWidthPt * 20) }] // pt -> DXA/twips
    : undefined;

  return new Paragraph({
    children,
    heading: group.headingLevel || undefined,
    bullet: group.bulleted ? { level: 0 } : undefined,
    alignment,
    tabStops,
    spacing: {
      before: (group.headingLevel ? 200 : 0) + group.extraBefore,
      after: group.headingLevel ? 100 : 80,
    },
  });
}

/** Convert a raw pdf.js decoded image (RGB/RGBA/grayscale) to PNG bytes via canvas. */
function imageToPng(img) {
  const { width, height, kind, data } = img;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const imageData = ctx.createImageData(width, height);
  const out = imageData.data;

  if (kind === 3) {
    // RGBA_32BPP
    out.set(data);
  } else if (kind === 2) {
    // RGB_24BPP
    for (let px = 0, i = 0; i < data.length; px += 4, i += 3) {
      out[px] = data[i];
      out[px + 1] = data[i + 1];
      out[px + 2] = data[i + 2];
      out[px + 3] = 255;
    }
  } else if (kind === 1) {
    // GRAYSCALE_1BPP (already expanded to bytes by pdf.js when returned here)
    for (let px = 0, i = 0; i < data.length; px += 4, i += 1) {
      const v = data[i];
      out[px] = v;
      out[px + 1] = v;
      out[px + 2] = v;
      out[px + 3] = 255;
    }
  } else {
    return null; // unsupported/unknown pixel format
  }

  ctx.putImageData(imageData, 0, 0);
  return new Promise((resolve) => {
    canvas.toBlob(async (blob) => {
      if (!blob) return resolve(null);
      resolve(new Uint8Array(await blob.arrayBuffer()));
    }, "image/png");
  });
}

/** Best-effort extraction of the raster images embedded in a page (in document order). */
async function extractPageImages(page) {
  const opList = await page.getOperatorList();
  const images = [];
  const seen = new Set();

  for (let i = 0; i < opList.fnArray.length; i += 1) {
    if (opList.fnArray[i] !== OPS.paintImageXObject) continue;
    const objId = opList.argsArray[i][0];
    if (seen.has(objId)) continue;
    seen.add(objId);

    try {
      const img = await new Promise((resolve) => {
        if (page.objs.has(objId)) resolve(page.objs.get(objId));
        else page.objs.get(objId, resolve);
      });
      if (!img || !img.width || !img.height || !img.data) continue;
      const png = await imageToPng(img);
      if (png) images.push({ png, width: img.width, height: img.height });
    } catch {
      // Skip images pdf.js can't resolve (e.g. unsupported color spaces) —
      // better to drop one image than fail the whole conversion.
    }
  }

  return images;
}

function imageParagraph(image) {
  const scale = Math.min(1, MAX_IMAGE_WIDTH_PT / image.width);
  return new Paragraph({
    children: [
      new ImageRun({
        type: "png",
        data: image.png,
        transformation: {
          width: Math.round(image.width * scale),
          height: Math.round(image.height * scale),
        },
      }),
    ],
    spacing: { before: 120, after: 120 },
  });
}

export async function pdfToWord(file, onProgress) {
  try {
    return await convertViaBackend({
      file,
      route: "/api/convert/pdf-to-word",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      onProgress,
    });
  } catch (err) {
    if (!(err instanceof BackendUnavailableError)) throw err;
    // No server configured/reachable — fall back to the in-browser converter.
  }
  return pdfToWordClientSide(file, onProgress);
}

async function pdfToWordClientSide(file, onProgress) {
  const pdfDoc = await loadPdfDocument(file);
  const total = pdfDoc.numPages;
  const children = [];
  const pagesData = [];
  const allSizes = [];

  // First pass: extract every line + its font size/weight, plus any embedded
  // images, per page. We need to see the whole document before deciding what
  // counts as "body text" vs a heading.
  for (let i = 1; i <= total; i += 1) {
    const page = await pdfDoc.getPage(i);
    // getOperatorList() must run before font info is available on
    // page.commonObjs — getTextContent() alone only exposes generic
    // fallback family names (e.g. "sans-serif"), not real bold/italic flags.
    // It's also how embedded images are discovered.
    const [content, images] = await Promise.all([page.getTextContent(), extractPageImages(page)]);
    const viewport = page.getViewport({ scale: 1 });
    const getStyle = buildFontStyleLookup(page, content.styles);
    const lines = groupIntoLines(content.items, getStyle, viewport.width);
    lines.forEach((line) => line.runs.forEach((r) => allSizes.push(r.sizePt)));
    pagesData.push({ lines, pageWidth: viewport.width, images });
    onProgress?.(Math.round((i / total) * 60));
  }

  const bodySizePt = median(allSizes);

  pagesData.forEach((pageData, idx) => {
    const { lines, pageWidth, images } = pageData;

    if (lines.length === 0 && images.length === 0) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: "(Halaman tanpa teks yang bisa diekstrak)", italics: true })],
        })
      );
    } else {
      const groups = buildParagraphGroups(lines, bodySizePt);
      groups.forEach((group) => children.push(groupToParagraph(group, pageWidth)));
      // Images can't be reliably placed mid-paragraph without fully
      // reimplementing pdf.js's rendering pipeline, so they're appended
      // after the page's text, in the order they appear in the PDF.
      images.forEach((image) => children.push(imageParagraph(image)));
    }

    if (idx < pagesData.length - 1) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }
    onProgress?.(60 + Math.round(((idx + 1) / pagesData.length) * 35));
  });

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  onProgress?.(100);
  return blob;
}
