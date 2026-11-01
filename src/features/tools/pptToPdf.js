import JSZip from "jszip";
import { PDFDocument, StandardFonts, rgb } from "@cantoo/pdf-lib";
import { convertViaBackend, BackendUnavailableError } from "./backendConvert";

// PPTX geometry is stored in EMU (English Metric Units). 1 point = 12700 EMU,
// so dividing by that constant maps a slide's native coordinate space
// directly onto PDF points with no extra scaling step.
const EMU_PER_PT = 12700;
const FALLBACK_PAGE_W = 720; // 10in landscape @72dpi, used only if slide size can't be read
const FALLBACK_PAGE_H = 540;

function emuToPt(emu) {
  return emu / EMU_PER_PT;
}

function hexToRgb(hex) {
  if (!hex || hex.length < 6) return null;
  const n = parseInt(hex, 16);
  if (Number.isNaN(n)) return null;
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** Read a:solidFill > a:srgbClr val="RRGGBB" from a direct parent element (non-recursive into children shapes). */
function readSolidFillHex(parentEl) {
  if (!parentEl) return null;
  const fill = Array.from(parentEl.children).find((c) => c.tagName === "a:solidFill");
  if (!fill) return null;
  const srgb = fill.getElementsByTagName("a:srgbClr")[0];
  return srgb?.getAttribute("val") || null;
}

/** Read <a:off x y> / <a:ext cx cy> from a shape's spPr > a:xfrm, in EMU. */
function readXfrm(spPr) {
  const xfrm = spPr?.getElementsByTagName("a:xfrm")[0];
  if (!xfrm) return null;
  const off = xfrm.getElementsByTagName("a:off")[0];
  const ext = xfrm.getElementsByTagName("a:ext")[0];
  if (!off || !ext) return null;
  return {
    x: parseInt(off.getAttribute("x"), 10) || 0,
    y: parseInt(off.getAttribute("y"), 10) || 0,
    cx: parseInt(ext.getAttribute("cx"), 10) || 0,
    cy: parseInt(ext.getAttribute("cy"), 10) || 0,
  };
}

function readParagraphRuns(spEl) {
  const paragraphs = Array.from(spEl.getElementsByTagName("a:p"));
  return paragraphs.map((p) => {
    const runs = Array.from(p.getElementsByTagName("a:r")).map((r) => {
      const rPr = r.getElementsByTagName("a:rPr")[0];
      const text = Array.from(r.getElementsByTagName("a:t"))
        .map((t) => t.textContent)
        .join("");
      const szAttr = rPr?.getAttribute("sz"); // hundredths of a point
      return {
        text,
        bold: rPr?.getAttribute("b") === "1",
        italic: rPr?.getAttribute("i") === "1",
        sizePt: szAttr ? parseInt(szAttr, 10) / 100 : null,
        colorHex: readSolidFillHex(rPr),
      };
    });
    const align = p.getElementsByTagName("a:pPr")[0]?.getAttribute("algn") || null;
    return { runs, align };
  });
}

async function readRels(zip, slideName) {
  const relsPath = `ppt/slides/_rels/${slideName}.rels`;
  const relsFile = zip.files[relsPath];
  if (!relsFile) return {};
  const xml = await relsFile.async("string");
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const map = {};
  Array.from(doc.getElementsByTagName("Relationship")).forEach((rel) => {
    map[rel.getAttribute("Id")] = rel.getAttribute("Target");
  });
  return map;
}

async function readPresentationSize(zip) {
  const file = zip.files["ppt/presentation.xml"];
  if (!file) return { widthPt: FALLBACK_PAGE_W, heightPt: FALLBACK_PAGE_H };
  const xml = await file.async("string");
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const sz = doc.getElementsByTagName("p:sldSz")[0];
  if (!sz) return { widthPt: FALLBACK_PAGE_W, heightPt: FALLBACK_PAGE_H };
  const cx = parseInt(sz.getAttribute("cx"), 10);
  const cy = parseInt(sz.getAttribute("cy"), 10);
  if (!cx || !cy) return { widthPt: FALLBACK_PAGE_W, heightPt: FALLBACK_PAGE_H };
  return { widthPt: emuToPt(cx), heightPt: emuToPt(cy) };
}

/** Resolve a slide-relative relationship target (e.g. "../media/image1.png") to a zip path. */
function resolveSlideRelativePath(target) {
  const parts = `ppt/slides/${target}`.split("/");
  const resolved = [];
  for (const part of parts) {
    if (part === "..") resolved.pop();
    else if (part !== ".") resolved.push(part);
  }
  return resolved.join("/");
}

async function extractSlides(zip) {
  const slideNames = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const na = parseInt(a.match(/slide(\d+)\.xml/)[1], 10);
      const nb = parseInt(b.match(/slide(\d+)\.xml/)[1], 10);
      return na - nb;
    });

  const parser = new DOMParser();
  const slides = [];

  for (const path of slideNames) {
    const name = path.split("/").pop();
    const xml = await zip.files[path].async("string");
    const doc = parser.parseFromString(xml, "application/xml");
    const rels = await readRels(zip, name);

    // p:bg wraps its fill one level deeper, in p:bgPr (or p:bgRef for theme
    // colors, which isn't a plain srgbClr and is intentionally left unhandled).
    const bgHex = readSolidFillHex(doc.getElementsByTagName("p:bgPr")[0]);

    const spTree = doc.getElementsByTagName("p:spTree")[0];
    const elements = [];
    if (spTree) {
      Array.from(spTree.children).forEach((node) => {
        if (node.tagName === "p:sp") {
          const spPr = node.getElementsByTagName("p:spPr")[0];
          const xfrm = readXfrm(spPr);
          const fillHex = readSolidFillHex(spPr);
          const isTitle = /title|ctrTitle/i.test(
            node.getElementsByTagName("p:ph")[0]?.getAttribute("type") || ""
          );
          const paragraphs = readParagraphRuns(node).filter((p) =>
            p.runs.some((r) => r.text.trim().length > 0)
          );
          if (paragraphs.length > 0 || fillHex) {
            elements.push({ type: "text", xfrm, fillHex, isTitle, paragraphs });
          }
        } else if (node.tagName === "p:pic") {
          const spPr = node.getElementsByTagName("p:spPr")[0];
          const xfrm = readXfrm(spPr);
          const blip = node.getElementsByTagName("a:blip")[0];
          const rId = blip?.getAttribute("r:embed");
          const target = rId ? rels[rId] : null;
          if (target) {
            elements.push({ type: "image", xfrm, mediaPath: resolveSlideRelativePath(target) });
          }
        }
      });
    }

    slides.push({ bgHex, elements });
  }

  return slides;
}

function wrapText(text, font, size, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";
  words.forEach((word) => {
    const trial = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(trial, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = trial;
    }
  });
  if (current) lines.push(current);
  return lines;
}

async function embedImage(pdfDoc, zip, mediaPath, cache) {
  if (cache.has(mediaPath)) return cache.get(mediaPath);
  const file = zip.files[mediaPath];
  if (!file) {
    cache.set(mediaPath, null);
    return null;
  }
  const bytes = await file.async("uint8array");
  let image = null;
  try {
    if (/\.png$/i.test(mediaPath)) {
      image = await pdfDoc.embedPng(bytes);
    } else if (/\.(jpe?g)$/i.test(mediaPath)) {
      image = await pdfDoc.embedJpg(bytes);
    }
    // Other formats (emf/wmf/gif/tiff/svg) can't be decoded client-side by
    // pdf-lib; those pictures are skipped rather than left broken.
  } catch {
    image = null;
  }
  cache.set(mediaPath, image);
  return image;
}

export async function pptToPdf(file, onProgress) {
  try {
    const blob = await convertViaBackend({
      file,
      route: "/api/convert/ppt-to-pdf",
      mimeType: "application/pdf",
      onProgress,
    });
    return { blob, warnings: [] };
  } catch (err) {
    if (!(err instanceof BackendUnavailableError)) throw err;
    // No server configured/reachable — fall back to the in-browser converter.
  }
  return pptToPdfClientSide(file, onProgress);
}

async function pptToPdfClientSide(file, onProgress) {
  onProgress?.(5);
  const zip = await JSZip.loadAsync(file);
  const { widthPt: PAGE_W, heightPt: PAGE_H } = await readPresentationSize(zip);
  const slides = await extractSlides(zip);

  const doc = await PDFDocument.create();
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const imageCache = new Map();
  let skippedImages = 0;

  for (let idx = 0; idx < slides.length; idx += 1) {
    const { bgHex, elements } = slides[idx];
    const page = doc.addPage([PAGE_W, PAGE_H]);

    if (bgHex) {
      const color = hexToRgb(bgHex);
      if (color) page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color });
    }

    let hasContent = false;

    for (const el of elements) {
      const xfrm = el.xfrm || { x: 0, y: 0, cx: PAGE_W * EMU_PER_PT, cy: PAGE_H * EMU_PER_PT };
      const boxX = emuToPt(xfrm.x);
      const boxTopY = PAGE_H - emuToPt(xfrm.y);
      const boxW = emuToPt(xfrm.cx);
      const boxH = emuToPt(xfrm.cy);

      if (el.type === "image") {
        // eslint-disable-next-line no-await-in-loop
        const image = await embedImage(doc, zip, el.mediaPath, imageCache);
        if (image) {
          page.drawImage(image, { x: boxX, y: boxTopY - boxH, width: boxW, height: boxH });
          hasContent = true;
        } else {
          skippedImages += 1;
        }
        continue;
      }

      // text shape
      if (el.fillHex) {
        const color = hexToRgb(el.fillHex);
        if (color) page.drawRectangle({ x: boxX, y: boxTopY - boxH, width: boxW, height: boxH, color });
      }

      let cursorY = boxTopY - 4;
      const maxWidth = Math.max(20, boxW - 8);

      for (const para of el.paragraphs) {
        const text = para.runs.map((r) => r.text).join("");
        if (!text.trim()) {
          cursorY -= el.isTitle ? 20 : 14;
          continue;
        }
        const firstRun = para.runs.find((r) => r.text.trim()) || para.runs[0] || {};
        const size = firstRun.sizePt || (el.isTitle ? 28 : 16);
        const font = firstRun.bold || el.isTitle ? fontBold : fontRegular;
        const color = hexToRgb(firstRun.colorHex) || rgb(0.09, 0.09, 0.11);
        const lineGap = size * 1.25;
        const prefix = el.isTitle ? "" : "•  ";

        const wrapped = wrapText(prefix + text, font, size, maxWidth);
        wrapped.forEach((wLine, i) => {
          if (cursorY - size < 0) return; // overflow: stop rendering further lines (best-effort)
          page.drawText(i === 0 ? wLine : "   " + wLine.replace(/^•\s*/, ""), {
            x: boxX + 4,
            y: cursorY - size,
            size,
            font,
            color,
          });
          cursorY -= lineGap;
          hasContent = true;
        });
      }
    }

    if (!hasContent) {
      page.drawText("(Slide tanpa konten yang dapat diekstrak)", {
        x: 40,
        y: PAGE_H / 2,
        size: 11,
        font: fontRegular,
        color: rgb(0.6, 0.6, 0.62),
      });
    }

    page.drawText(`${idx + 1}`, {
      x: PAGE_W - 40,
      y: 16,
      size: 9,
      font: fontRegular,
      color: rgb(0.55, 0.56, 0.6),
    });

    onProgress?.(5 + Math.round(((idx + 1) / slides.length) * 90));
  }

  const bytes = await doc.save();
  onProgress?.(100);
  return {
    blob: new Blob([bytes], { type: "application/pdf" }),
    warnings:
      skippedImages > 0
        ? [`${skippedImages} gambar dilewati (format tidak didukung di browser: EMF/WMF/GIF/TIFF).`]
        : [],
  };
}
