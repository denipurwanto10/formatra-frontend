// True PDF text editing, at the content-stream level.
//
// The old "Edit Teks Asli" tool covered original glyphs with an opaque
// rectangle and drew the replacement as a rasterized image on export: the
// original text was still physically present in the PDF (just hidden under
// pixels), and the "edited" text wasn't real vector text at all. This module
// does the real thing instead:
//
//   1. Decode and parse a page's content stream into PDF operators.
//   2. Find exactly which `Tj`/`TJ`/`'`/`"` (show-text) operators drew the
//      line the user edited, by decoding each operator's bytes to text and
//      requiring it to line up 1:1, in order, with what pdf.js extracted for
//      that page. If anything doesn't line up exactly, we bail out for that
//      whole page rather than guess — a wrong redaction (deleting the wrong
//      run) is much worse than falling back to the old overlay behaviour.
//   3. Blank out (not cover up) the matched operator(s), so the original
//      glyphs are actually gone from the PDF, not hidden underneath a box.
//   4. Re-serialize the content stream and write it back onto the page.
//   5. The caller then draws the new text as real, selectable vector text
//      via pdf-lib's `drawText`, using the position/size already known from
//      pdf.js and a best-effort font/colour match recovered while walking
//      the operators.
//
// What this can't do: PDF has no concept of a paragraph or a reflowable text
// box — every glyph is placed independently. So edits reflow *within the
// line being edited* (handled by the caller sizing the drawn text), but
// typing enough text to overflow a line will not push the following lines
// down, because that isn't something a PDF's content stream expresses. True
// paragraph reflow needs a structured format — this app's PDF → Word tool is
// the right place for that kind of edit.

import {
  PDFArray,
  PDFDict,
  PDFName,
  PDFNumber,
  PDFStream,
  PDFRawStream,
  PDFContentStream,
  parseContentStream,
  parseToUnicode,
  decodePDFRawStream,
} from "@cantoo/pdf-lib";

// PDF FontDescriptor /Flags bit positions (1-indexed in the spec, so
// subtract 1 for the JS bit shift). Only the two we act on are named.
const FONT_FLAG_ITALIC = 1 << 6; // bit 7
const FONT_FLAG_FORCE_BOLD = 1 << 18; // bit 19

// ---------------------------------------------------------------------------
// Byte-level helpers
// ---------------------------------------------------------------------------

function mergeUint8Arrays(parts) {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

function decodeStreamBytes(stream) {
  if (stream instanceof PDFRawStream) return decodePDFRawStream(stream).decode();
  if (stream instanceof PDFContentStream) return stream.getUnencodedContents();
  return stream.getContents();
}

/** Windows-1252 codepoints that differ from Latin-1 in the 0x80-0x9F block. */
const CP1252_HIGH = {
  0x80: "\u20AC", 0x82: "\u201A", 0x83: "\u0192", 0x84: "\u201E", 0x85: "\u2026",
  0x86: "\u2020", 0x87: "\u2021", 0x88: "\u02C6", 0x89: "\u2030", 0x8a: "\u0160",
  0x8b: "\u2039", 0x8c: "\u0152", 0x8e: "\u017D", 0x91: "\u2018", 0x92: "\u2019",
  0x93: "\u201C", 0x94: "\u201D", 0x95: "\u2022", 0x96: "\u2013", 0x97: "\u2014",
  0x98: "\u02DC", 0x99: "\u2122", 0x9a: "\u0161", 0x9b: "\u203A", 0x9c: "\u0153",
  0x9e: "\u017E", 0x9f: "\u0178",
};

function simpleByteToChar(code) {
  return CP1252_HIGH[code] || String.fromCharCode(code);
}

// ---------------------------------------------------------------------------
// Page content-stream access
// ---------------------------------------------------------------------------

/** Decode + merge all of a page's content streams into one operator list. */
export function getPageOperations(pdfLibPage) {
  pdfLibPage.node.normalize();
  const { Contents } = pdfLibPage.node.normalizedEntries();
  if (!Contents || !(Contents instanceof PDFArray) || Contents.size() === 0) {
    return [];
  }
  const parts = [];
  for (let i = 0; i < Contents.size(); i += 1) {
    const stream = Contents.lookup(i, PDFStream);
    parts.push(decodeStreamBytes(stream));
    parts.push(Uint8Array.of(0x0a));
  }
  return parseContentStream(mergeUint8Arrays(parts));
}

function getResourcesDict(pdfLibPage) {
  pdfLibPage.node.normalize();
  return pdfLibPage.node.normalizedEntries().Resources;
}

/**
 * Look up a font's /FontDescriptor (following /DescendantFonts for Type0
 * composite fonts) and read its /Flags, best-effort. Returns 0 (no flags
 * set) on any failure rather than throwing — flags are only ever used as an
 * extra signal alongside the BaseFont-name heuristic, never the sole source
 * of truth.
 */
function getFontDescriptorFlags(fontDict) {
  try {
    let descriptor = fontDict.lookupMaybe(PDFName.of("FontDescriptor"), PDFDict);
    if (!descriptor) {
      const descendants = fontDict.lookupMaybe(PDFName.of("DescendantFonts"), PDFArray);
      const first = descendants && descendants.size() > 0 ? descendants.lookup(0, PDFDict) : null;
      descriptor = first ? first.lookupMaybe(PDFName.of("FontDescriptor"), PDFDict) : null;
    }
    if (!descriptor) return 0;
    const flags = descriptor.lookupMaybe(PDFName.of("Flags"), PDFNumber);
    return flags ? flags.asNumber() : 0;
  } catch {
    return 0;
  }
}

/** Build a `bytes -> text` decoder for a /Font resource, best-effort. */
function buildFontDecoder(fontDict) {
  if (!fontDict) {
    return {
      decode: (bytes) => Array.from(bytes).map(simpleByteToChar).join(""),
      baseName: "",
      bold: false,
      italic: false,
    };
  }

  const subtype = fontDict.lookupMaybe(PDFName.of("Subtype"), PDFName);
  const isType0 = !!subtype && subtype.asString().replace("/", "") === "Type0";
  const baseFontName = fontDict.lookupMaybe(PDFName.of("BaseFont"), PDFName);
  const baseName = baseFontName ? baseFontName.asString().replace(/^\//, "") : "";
  const flags = getFontDescriptorFlags(fontDict);
  // The /FontDescriptor flags are the authoritative source when present;
  // the BaseFont name (e.g. "Arial-BoldMT") is the fallback for fonts whose
  // descriptor omits or under-reports them, which is common in practice.
  const nameLower = baseName.replace(/^[A-Z]{6}\+/, "").toLowerCase();
  const bold = !!(flags & FONT_FLAG_FORCE_BOLD) || /bold|black|heavy/.test(nameLower);
  const italic = !!(flags & FONT_FLAG_ITALIC) || /italic|oblique/.test(nameLower);

  let uniMap = null;
  const toUnicode = fontDict.lookupMaybe(PDFName.of("ToUnicode"), PDFStream);
  if (toUnicode) {
    try {
      uniMap = parseToUnicode(decodeStreamBytes(toUnicode));
    } catch {
      uniMap = null;
    }
  }

  const bytesPerCode = isType0 ? 2 : 1;
  const decode = (bytes) => {
    let out = "";
    for (let i = 0; i < bytes.length; i += bytesPerCode) {
      let code = 0;
      for (let j = 0; j < bytesPerCode && i + j < bytes.length; j += 1) {
        code = (code << 8) | bytes[i + j];
      }
      if (uniMap && uniMap.has(code)) out += uniMap.get(code);
      else if (!isType0) out += simpleByteToChar(code);
      else out += "\uFFFD"; // unmappable CID code: force a downstream mismatch, never guess
    }
    return out;
  };
  return { decode, baseName, bold, italic };
}

function fillColorFromState(state) {
  return state.fill || "#000000";
}

function toHex(r, g, b) {
  const c = (v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

function cmykToHex(c, m, y, k) {
  return toHex((1 - c) * (1 - k), (1 - m) * (1 - k), (1 - y) * (1 - k));
}

const SHOW_TEXT_OPS = new Set(["Tj", "TJ", "'", '"']);
const POSITION_OPS = new Set(["Td", "TD", "Tm", "T*"]);

/**
 * Walk a page's operator list once, tracking font/colour state, and produce
 * a decoded-text record for every show-text operator, in document order.
 */
export function buildOperatorRecords(operations, resources) {
  const fontCache = new Map();
  let currentDecoder = null;
  let fill = "#000000";
  // Text-state operators (Tc/Tw/Tz/Tr/Ts) sit outside the show-text ops
  // themselves but shape how the glyphs they draw are placed/rendered —
  // tracked here so callers can reproduce them on export instead of only
  // ever assuming the PDF defaults (0, 0, 100, 0, 0).
  let charSpacing = 0;
  let wordSpacing = 0;
  let hScale = 100;
  let renderMode = 0;
  let rise = 0;
  const records = [];

  const getFontDecoder = (fontName) => {
    if (fontCache.has(fontName)) return fontCache.get(fontName);
    let fontDict = null;
    try {
      const fontsDict = resources?.lookupMaybe(PDFName.of("Font"), PDFDict);
      fontDict = fontsDict?.lookupMaybe(PDFName.of(fontName), PDFDict) || null;
    } catch {
      fontDict = null;
    }
    const decoder = buildFontDecoder(fontDict);
    fontCache.set(fontName, decoder);
    return decoder;
  };

  operations.forEach((op, opIndex) => {
    const { name, args } = op;
    if (name === "Tf" && args[0]?.type === "name") {
      currentDecoder = getFontDecoder(args[0].value);
      return;
    }
    if (name === "rg" && args.length >= 3) {
      fill = toHex(args[0], args[1], args[2]);
      return;
    }
    if (name === "g" && args.length >= 1) {
      fill = toHex(args[0], args[0], args[0]);
      return;
    }
    if (name === "k" && args.length >= 4) {
      fill = cmykToHex(args[0], args[1], args[2], args[3]);
      return;
    }
    if ((name === "sc" || name === "scn") && args.length === 1 && typeof args[0] === "number") {
      fill = toHex(args[0], args[0], args[0]);
      return;
    }
    if ((name === "sc" || name === "scn") && args.length >= 3 && typeof args[0] === "number") {
      fill = toHex(args[0], args[1], args[2]);
      return;
    }
    if (name === "Tc" && typeof args[0] === "number") {
      charSpacing = args[0];
      return;
    }
    if (name === "Tw" && typeof args[0] === "number") {
      wordSpacing = args[0];
      return;
    }
    if (name === "Tz" && typeof args[0] === "number") {
      hScale = args[0];
      return;
    }
    if (name === "Tr" && typeof args[0] === "number") {
      renderMode = args[0];
      return;
    }
    if (name === "Ts" && typeof args[0] === "number") {
      rise = args[0];
      return;
    }

    if (!SHOW_TEXT_OPS.has(name)) return;

    const decoder =
      currentDecoder ||
      { decode: (b) => Array.from(b).map(simpleByteToChar).join(""), baseName: "", bold: false, italic: false };
    let text = "";
    if (name === "Tj" || name === "'") {
      const strArg = args[args.length - 1];
      if (strArg?.type === "string") text = decoder.decode(strArg.bytes);
      else if (strArg?.type === "hexString") text = decoder.decode(strArg.bytes);
    } else if (name === '"') {
      const strArg = args[args.length - 1];
      if (strArg?.type === "string" || strArg?.type === "hexString") text = decoder.decode(strArg.bytes);
    } else if (name === "TJ") {
      const arr = args[0];
      if (Array.isArray(arr)) {
        text = arr
          .filter((item) => item?.type === "string" || item?.type === "hexString")
          .map((item) => decoder.decode(item.bytes))
          .join("");
      }
    }

    records.push({
      opIndex,
      text,
      fontBaseName: decoder.baseName,
      color: fillColorFromState({ fill }),
      bold: decoder.bold,
      italic: decoder.italic,
      charSpacing,
      wordSpacing,
      hScale,
      renderMode,
      rise,
    });
  });

  return records;
}

function normalizeForMatch(str) {
  return (str || "").replace(/\s+/g, " ").trim();
}

/**
 * Try to line up decoded content-stream show-text operators 1:1, in order,
 * with pdf.js's extracted text items for the same page. Returns null if they
 * don't match exactly anywhere — meaning we can't safely redact this page's
 * content stream (unsupported structure, exotic encoding, etc.) and every
 * edit on it should fall back to the overlay approach instead.
 */
export function matchOperatorsToItems(operatorRecords, flatItems) {
  if (operatorRecords.length !== flatItems.length) return null;
  for (let i = 0; i < flatItems.length; i += 1) {
    if (normalizeForMatch(operatorRecords[i].text) !== normalizeForMatch(flatItems[i].text)) {
      return null;
    }
  }
  return operatorRecords; // records[i] <-> flatItems[i], index for index
}

/**
 * Whether it's safe to blank the show-text operator(s) behind `itemIndices`
 * (all belonging to one edited line) without shifting unrelated text that
 * follows it. Unsafe when a *different*, un-edited run on the same line
 * relies on this run's implicit text-matrix advance (no repositioning
 * operator between them) — in that case we leave the operator alone and let
 * the caller fall back to the overlay method for that line.
 */
export function isRedactionSafe(operations, operatorRecords, itemIndices) {
  const opIndexSet = new Set(itemIndices.map((i) => operatorRecords[i].opIndex));
  const lastOpIndex = Math.max(...itemIndices.map((i) => operatorRecords[i].opIndex));
  const lastOp = operations[lastOpIndex];

  // `'`/`"` always reposition to the next line as part of themselves, so
  // whatever comes after never depends on their implicit glyph advance.
  if (lastOp.name === "'" || lastOp.name === '"') return true;

  for (let i = lastOpIndex + 1; i < operations.length; i += 1) {
    const op = operations[i];
    if (op.name === "BT" || op.name === "ET" || POSITION_OPS.has(op.name)) return true;
    if (SHOW_TEXT_OPS.has(op.name)) {
      // Another show-text op immediately follows with no repositioning.
      // Safe only if it's part of the *same* edited line.
      return opIndexSet.has(i);
    }
    // Anything else (Tf, Tc, Tw, Tz, TL, Tr, Ts, gs, cs...) doesn't move the
    // pen, so keep scanning forward.
  }
  return true; // reached the end of the stream without another show-text op
}

/** Blank the show-text operator(s) for one edited line so nothing is drawn. */
export function redactOperators(operations, operatorRecords, itemIndices) {
  itemIndices.forEach((i) => {
    const opIndex = operatorRecords[i].opIndex;
    const op = operations[opIndex];
    if (op.name === "TJ") {
      operations[opIndex] = { name: "TJ", args: [[]] };
    } else {
      // Tj, ', " all take the literal string as their last argument.
      const args = [...op.args];
      args[args.length - 1] = { type: "string", bytes: new Uint8Array(0) };
      operations[opIndex] = { name: op.name, args };
    }
  });
}

// ---------------------------------------------------------------------------
// Serialization: operator list -> raw content-stream bytes
// ---------------------------------------------------------------------------

function formatNumber(n) {
  if (!Number.isFinite(n)) return "0";
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}

function escapeName(value) {
  let out = "/";
  for (const ch of String(value)) {
    const code = ch.charCodeAt(0);
    if (code <= 0x20 || code > 0x7e || "()<>[]{}/%#".includes(ch)) {
      out += `#${code.toString(16).padStart(2, "0")}`;
    } else {
      out += ch;
    }
  }
  return out;
}

function escapeLiteralBytes(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i += 1) {
    const b = bytes[i];
    if (b === 0x28 || b === 0x29 || b === 0x5c) out += `\\${String.fromCharCode(b)}`;
    else if (b === 0x0a) out += "\\n";
    else if (b === 0x0d) out += "\\r";
    else if (b < 0x20 || b > 0x7e) out += `\\${b.toString(8).padStart(3, "0")}`;
    else out += String.fromCharCode(b);
  }
  return out;
}

function serializeOperand(operand) {
  if (typeof operand === "number") return formatNumber(operand);
  if (Array.isArray(operand)) return `[${operand.map(serializeOperand).join(" ")}]`;
  if (operand && typeof operand === "object") {
    if (operand.type === "name") return escapeName(operand.value);
    if (operand.type === "hexString") {
      return `<${Array.from(operand.bytes).map((b) => b.toString(16).padStart(2, "0")).join("")}>`;
    }
    if (operand.type === "string") return `(${escapeLiteralBytes(operand.bytes)})`;
    // Dict operand (e.g. BDC property lists) — best-effort round trip.
    const entries = Object.keys(operand)
      .map((k) => `${escapeName(k)} ${serializeOperand(operand[k])}`)
      .join(" ");
    return `<< ${entries} >>`;
  }
  return String(operand ?? "");
}

/** Reverse of `parseContentStream`: operators -> raw bytes, ASCII-safe. */
export function serializeOperations(operations) {
  let out = "";
  operations.forEach((op) => {
    op.args.forEach((arg) => {
      out += `${serializeOperand(arg)} `;
    });
    out += `${op.name}\n`;
  });
  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i += 1) bytes[i] = out.charCodeAt(i) & 0xff;
  return bytes;
}

/** Replace a page's content stream with a modified operator list. */
export function writePageOperations(pdfLibPage, operations) {
  const bytes = serializeOperations(operations);
  const context = pdfLibPage.doc.context;
  const streamRef = context.register(context.flateStream(bytes));
  pdfLibPage.node.set(PDFName.of("Contents"), context.obj([streamRef]));
}

/**
 * Top-level helper: given a copied pdf-lib page and the pdf.js-derived
 * lines for that page (each with `itemIndices` into `flatItems`, matching
 * textLines.js's output), work out which lines can be truly redacted from
 * the content stream, and which must fall back to the overlay method.
 *
 * Returns { supported, safeLineIndices: Set<number>, lineInfo: Map<lineIndex, {color, fontBaseName}> }
 * `safeLineIndices` only contains indices for lines the caller actually
 * asked about (via `editedLineIndices`) that turned out to be redactable.
 * Nothing is mutated until the caller calls `applyRedactions`.
 */
export function planRedaction({ pdfLibPage, flatItems, lines, editedLineIndices }) {
  const operations = getPageOperations(pdfLibPage);
  if (operations.length === 0) return { supported: false, operations, safeLineIndices: new Set(), lineInfo: new Map() };

  const resources = getResourcesDict(pdfLibPage);
  const operatorRecords = buildOperatorRecords(operations, resources);
  const matched = matchOperatorsToItems(operatorRecords, flatItems);
  if (!matched) return { supported: false, operations, safeLineIndices: new Set(), lineInfo: new Map() };

  const safeLineIndices = new Set();
  const lineInfo = new Map();

  editedLineIndices.forEach((lineIndex) => {
    const line = lines[lineIndex];
    if (!line || !line.itemIndices || line.itemIndices.length === 0) return;
    const safe = isRedactionSafe(operations, matched, line.itemIndices);
    const first = matched[line.itemIndices[0]];
    lineInfo.set(lineIndex, {
      color: first.color,
      fontBaseName: first.fontBaseName,
      bold: first.bold,
      italic: first.italic,
      charSpacing: first.charSpacing,
      wordSpacing: first.wordSpacing,
      hScale: first.hScale,
      renderMode: first.renderMode,
      rise: first.rise,
    });
    if (safe) safeLineIndices.add(lineIndex);
  });

  return { supported: true, operations, operatorRecords: matched, safeLineIndices, lineInfo };
}

/** Mutate `plan.operations` in place, blanking every safe edited line. */
export function applyRedactions(plan, lines, editedLineIndices) {
  editedLineIndices.forEach((lineIndex) => {
    if (!plan.safeLineIndices.has(lineIndex)) return;
    const line = lines[lineIndex];
    redactOperators(plan.operations, plan.operatorRecords, line.itemIndices);
  });
}

/**
 * Best-effort mapping from an embedded font's BaseFont name to a Standard14
 * family. `boldHint`/`italicHint` let callers pass in a more authoritative
 * signal (e.g. the /FontDescriptor flags `buildFontDecoder` already read, or
 * the pdf.js-detected shear from textLines.js) — they OR with the name-based
 * heuristic rather than replace it, since either source alone can miss it.
 */
export function guessStandardFont(baseFontName, italicHint, boldHint) {
  const name = (baseFontName || "").replace(/^[A-Z]{6}\+/, "").toLowerCase();
  const bold = !!boldHint || /bold|black|heavy/.test(name);
  const italic = !!italicHint || /italic|oblique/.test(name);
  let family = "helvetica";
  if (/times|serif|georgia|cambria|garamond|minion|book/.test(name)) family = "times";
  else if (/courier|mono|consolas|menlo/.test(name)) family = "courier";
  return { family, bold, italic };
}
