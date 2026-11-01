// Client-side PDF -> PowerPoint conversion: renders every PDF page to a PNG
// (pdf.js) and packs one full-slide image per slide into a minimal but valid
// .pptx package (JSZip). No server round-trip, no new dependencies.
//
// The slide size follows the first page's aspect ratio (capped at ~13.33in on
// the long edge) so portrait documents don't come out letterboxed on a
// landscape slide.

import JSZip from "jszip";
import { loadPdfDocument, renderPageToCanvas } from "../../lib/pdfjs";

const EMU_PER_INCH = 914400;
const MAX_SLIDE_IN = 13.333;
const RENDER_DPI = 150;

const NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

function groupShapeXml(cx, cy) {
  return (
    `<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>` +
    `<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/>` +
    `<a:chOff x="0" y="0"/><a:chExt cx="${cx}" cy="${cy}"/></a:xfrm></p:grpSpPr>`
  );
}

function contentTypesXml(slideCount) {
  let slides = "";
  for (let i = 1; i <= slideCount; i += 1) {
    slides += `<Override PartName="/ppt/slides/slide${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`;
  }
  return (
    `${XML_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Default Extension="png" ContentType="image/png"/>` +
    `<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>` +
    `<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>` +
    `<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>` +
    `<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>` +
    `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>` +
    `<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>` +
    `${slides}</Types>`
  );
}

const ROOT_RELS =
  `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>`;

function presentationXml(cx, cy, slideCount) {
  let ids = "";
  for (let i = 1; i <= slideCount; i += 1) {
    ids += `<p:sldId id="${255 + i}" r:id="rId${i + 1}"/>`;
  }
  return (
    `${XML_HEAD}<p:presentation ${NS}>` +
    `<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>` +
    `<p:sldIdLst>${ids}</p:sldIdLst>` +
    `<p:sldSz cx="${cx}" cy="${cy}"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`
  );
}

function presentationRelsXml(slideCount) {
  let rels =
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>`;
  for (let i = 1; i <= slideCount; i += 1) {
    rels += `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i}.xml"/>`;
  }
  return `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`;
}

function masterXml(cx, cy) {
  return (
    `${XML_HEAD}<p:sldMaster ${NS}>` +
    `<p:cSld><p:bg><p:bgRef idx="1001"><a:lt1/></p:bgRef></p:bg>` +
    `<p:spTree>${groupShapeXml(cx, cy)}</p:spTree></p:cSld>` +
    `<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>` +
    `<p:txStyles><p:titleStyle><a:lvl1pPr/></p:titleStyle><p:bodyStyle><a:lvl1pPr/></p:bodyStyle><p:otherStyle><a:lvl1pPr/></p:otherStyle></p:txStyles>` +
    `</p:sldMaster>`
  );
}

const MASTER_RELS =
  `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>` +
  `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>`;

function layoutXml(cx, cy) {
  return (
    `${XML_HEAD}<p:sldLayout ${NS} type="blank" showMasterSp="0" showMasterPhAnim="0">` +
    `<p:cSld name="Blank"><p:spTree>${groupShapeXml(cx, cy)}</p:spTree></p:cSld>` +
    `<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`
  );
}

const LAYOUT_RELS =
  `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>`;

function slideXml(cx, cy, pageNum, picId) {
  return (
    `${XML_HEAD}<p:sld ${NS}>` +
    `<p:cSld><p:spTree>${groupShapeXml(cx, cy)}` +
    `<p:pic><p:nvPicPr><p:cNvPr id="${picId}" name="Halaman ${pageNum}"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>` +
    `<p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>` +
    `<p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>` +
    `</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`
  );
}

function slideRelsXml(pageNum) {
  return (
    `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>` +
    `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image${pageNum}.png"/></Relationships>`
  );
}

const THEME_XML =
  `${XML_HEAD}<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Formatra Theme">` +
  `<a:themeElements><a:clrScheme name="Formatra">` +
  `<a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>` +
  `<a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>` +
  `<a:dk2><a:srgbClr val="1F497D"/></a:dk2><a:lt2><a:srgbClr val="EEECE1"/></a:lt2>` +
  `<a:accent1><a:srgbClr val="4F81BD"/></a:accent1><a:accent2><a:srgbClr val="C0504D"/></a:accent2>` +
  `<a:accent3><a:srgbClr val="9BBB59"/></a:accent3><a:accent4><a:srgbClr val="806000"/></a:accent4>` +
  `<a:accent5><a:srgbClr val="4BACC6"/></a:accent5><a:accent6><a:srgbClr val="F79646"/></a:accent6>` +
  `<a:hlink><a:srgbClr val="0000FF"/></a:hlink><a:folHlink><a:srgbClr val="800080"/></a:folHlink>` +
  `</a:clrScheme><a:fmtScheme name="Formatra"><a:fillStyleLst>` +
  `<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>` +
  `<a:gradFill rotWithShape="0"><a:gsLst>` +
  `<a:gs pos="0"><a:schemeClr val="phClr"><a:tint val="50000"/><a:satMod val="300000"/></a:schemeClr></a:gs>` +
  `<a:gs pos="100000"><a:schemeClr val="phClr"><a:lumMod val="35000"/><a:satMod val="350000"/></a:schemeClr></a:gs>` +
  `</a:gsLst><a:lin ang="16200000" scaled="1"/></a:gradFill>` +
  `<a:gradFill rotWithShape="0"><a:gsLst>` +
  `<a:gs pos="0"><a:schemeClr val="phClr"><a:tint val="80000"/><a:satMod val="300000"/></a:schemeClr></a:gs>` +
  `<a:gs pos="100000"><a:schemeClr val="phClr"><a:lumMod val="30000"/><a:satMod val="200000"/></a:schemeClr></a:gs>` +
  `</a:gsLst><a:lin ang="16200000" scaled="0"/></a:gradFill></a:fillStyleLst><a:lnStyleLst>` +
  `<a:ln w="6350" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln>` +
  `<a:ln w="12700" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln>` +
  `<a:ln w="19050" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln>` +
  `</a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle>` +
  `<a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst>` +
  `<a:outerShdw blurRad="57150" dist="38100" dir="5400000" algn="ctr" rotWithShape="0">` +
  `<a:srgbClr val="000000"><a:alpha val="63000"/></a:srgbClr></a:outerShdw></a:effectLst></a:effectStyle>` +
  `</a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill>` +
  `<a:gradFill rotWithShape="0"><a:gsLst>` +
  `<a:gs pos="0"><a:schemeClr val="phClr"><a:tint val="40000"/><a:satMod val="350000"/></a:schemeClr></a:gs>` +
  `<a:gs pos="40000"><a:schemeClr val="phClr"><a:tint val="45000"/><a:shade val="99000"/><a:satMod val="350000"/></a:schemeClr></a:gs>` +
  `<a:gs pos="100000"><a:schemeClr val="phClr"><a:shade val="20000"/><a:satMod val="350000"/></a:schemeClr></a:gs>` +
  `</a:gsLst><a:path path="circle"><a:fillToRect l="50000" t="-80000" r="50000" b="180000"/></a:path></a:gradFill>` +
  `<a:gradFill rotWithShape="0"><a:gsLst>` +
  `<a:gs pos="0"><a:schemeClr val="phClr"><a:tint val="80000"/><a:satMod val="300000"/></a:schemeClr></a:gs>` +
  `<a:gs pos="100000"><a:schemeClr val="phClr"><a:shade val="30000"/><a:satMod val="200000"/></a:schemeClr></a:gs>` +
  `</a:gsLst><a:path path="circle"><a:fillToRect l="50000" t="50000" r="50000" b="50000"/></a:path></a:gradFill>` +
  `</a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`;

function coreXml(title) {
  const safe = String(title || "Dokumen")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const now = new Date().toISOString();
  return (
    `${XML_HEAD}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ` +
    `xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" ` +
    `xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
    `<dc:title>${safe}</dc:title><dc:creator>Formatra</dc:creator>` +
    `<dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>` +
    `<dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`
  );
}

function appXml(slideCount) {
  return (
    `${XML_HEAD}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" ` +
    `xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">` +
    `<Application>Formatra</Application><Slides>${slideCount}</Slides></Properties>`
  );
}

/**
 * Converts every page of a PDF into a full-slide image slide (.pptx).
 * Text becomes part of the slide image (not editable text) — the same
 * trade-off as the rasterize compression modes, stated openly in the UI.
 *
 * @param {File} file
 * @param {(progress:number)=>void} [onProgress]
 * @returns {Promise<Blob>}
 */
export async function pdfToPowerpoint(file, onProgress) {
  onProgress?.(5);
  const pdfDoc = await loadPdfDocument(file);
  const total = pdfDoc.numPages;
  if (!total) throw new Error("PDF tidak memiliki halaman.");

  // Slide size follows the first page's aspect ratio (points -> inches).
  const firstPage = await pdfDoc.getPage(1);
  const firstVp = firstPage.getViewport({ scale: 1 });
  let wIn = firstVp.width / 72;
  let hIn = firstVp.height / 72;
  const longest = Math.max(wIn, hIn);
  if (longest > MAX_SLIDE_IN) {
    const k = MAX_SLIDE_IN / longest;
    wIn *= k;
    hIn *= k;
  }
  const cx = Math.round(wIn * EMU_PER_INCH);
  const cy = Math.round(hIn * EMU_PER_INCH);

  const zip = new JSZip();
  zip.file("[Content_Types].xml", contentTypesXml(total));
  zip.folder("_rels").file(".rels", ROOT_RELS);
  zip.folder("docProps").file("core.xml", coreXml(file.name.replace(/\.[^/.]+$/, "")));
  zip.folder("docProps").file("app.xml", appXml(total));
  zip.folder("ppt").file("presentation.xml", presentationXml(cx, cy, total));
  zip.folder("ppt/_rels").file("presentation.xml.rels", presentationRelsXml(total));
  zip.folder("ppt/slideMasters").file("slideMaster1.xml", masterXml(cx, cy));
  zip.folder("ppt/slideMasters/_rels").file("slideMaster1.xml.rels", MASTER_RELS);
  zip.folder("ppt/slideLayouts").file("slideLayout1.xml", layoutXml(cx, cy));
  zip.folder("ppt/slideLayouts/_rels").file("slideLayout1.xml.rels", LAYOUT_RELS);
  zip.folder("ppt/theme").file("theme1.xml", THEME_XML);

  const renderScale = RENDER_DPI / 72;
  for (let i = 1; i <= total; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const { canvas } = await renderPageToCanvas(pdfDoc, i, renderScale);
    // eslint-disable-next-line no-await-in-loop
    const blob = await new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Browser gagal me-render halaman PDF."))), "image/png")
    );
    zip.folder("ppt/media").file(`image${i}.png`, blob);
    zip.folder("ppt/slides").file(`slide${i}.xml`, slideXml(cx, cy, i, i + 1));
    zip.folder("ppt/slides/_rels").file(`slide${i}.xml.rels`, slideRelsXml(i));
    onProgress?.(Math.round((i / total) * 90));
  }

  const out = await zip.generateAsync({ type: "blob" });
  onProgress?.(100);
  return new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  });
}
