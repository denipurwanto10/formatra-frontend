import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

const PX_PER_MM = 96 / 25.4; // at CSS 96dpi

const PAGE_SIZES_MM = {
  a4: { w: 210, h: 297 },
  letter: { w: 215.9, h: 279.4 },
  legal: { w: 215.9, h: 355.6 },
};

/**
 * Render an HTML string inside an offscreen container sized to the chosen
 * page width/margins, rasterize it, and paginate the result into a jsPDF
 * document.
 *
 * @param {string} html
 * @param {(progress:number)=>void} onProgress
 * @param {object} [options]
 * @param {"a4"|"letter"|"legal"} [options.pageSize]
 * @param {"portrait"|"landscape"} [options.orientation]
 * @param {number} [options.marginMm] margin applied on all four sides
 */
export async function htmlToPdfBlob(html, onProgress, options = {}) {
  const { pageSize = "a4", orientation = "portrait", marginMm = 18 } = options;
  const base = PAGE_SIZES_MM[pageSize] || PAGE_SIZES_MM.a4;
  const pageWidthMm = orientation === "landscape" ? base.h : base.w;
  const pageHeightMm = orientation === "landscape" ? base.w : base.h;
  const contentWidthMm = Math.max(20, pageWidthMm - marginMm * 2);

  const widthPx = Math.round(contentWidthMm * PX_PER_MM);
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.top = "0";
  container.style.left = "-99999px";
  container.style.width = `${widthPx}px`;
  container.style.background = "#ffffff";
  container.style.color = "#111111";
  container.style.boxSizing = "border-box";
  container.style.fontFamily = "'Times New Roman', Georgia, serif";
  container.style.fontSize = "13px";
  container.style.lineHeight = "1.5";
  container.innerHTML = html;

  document.body.appendChild(container);
  onProgress?.(15);

  let canvas;
  try {
    canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
    });
  } finally {
    document.body.removeChild(container);
  }
  onProgress?.(60);

  const pdf = new jsPDF({ unit: "mm", format: [pageWidthMm, pageHeightMm] });
  const contentHeightMm = pageHeightMm - marginMm * 2;
  const pageHeightPx = (canvas.width / contentWidthMm) * contentHeightMm;
  const totalPages = Math.max(1, Math.ceil(canvas.height / pageHeightPx));

  for (let i = 0; i < totalPages; i += 1) {
    const sliceCanvas = document.createElement("canvas");
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = Math.min(pageHeightPx, canvas.height - i * pageHeightPx);
    const ctx = sliceCanvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
    ctx.drawImage(
      canvas,
      0,
      i * pageHeightPx,
      canvas.width,
      sliceCanvas.height,
      0,
      0,
      canvas.width,
      sliceCanvas.height
    );

    const imgData = sliceCanvas.toDataURL("image/jpeg", 0.92);
    const sliceHeightMm = (sliceCanvas.height / canvas.width) * contentWidthMm;
    if (i > 0) pdf.addPage([pageWidthMm, pageHeightMm]);
    pdf.addImage(imgData, "JPEG", marginMm, marginMm, contentWidthMm, sliceHeightMm);
    onProgress?.(60 + Math.round(((i + 1) / totalPages) * 35));
  }

  onProgress?.(100);
  return pdf.output("blob");
}
