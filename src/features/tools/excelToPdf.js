import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export async function excelToPdf(file, onProgress) {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  onProgress?.(15);

  const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  const sheetNames = workbook.SheetNames;
  let renderedAny = false;

  sheetNames.forEach((name, sheetIdx) => {
    const sheet = workbook.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, blankrows: false });
    if (rows.length === 0) return;

    const [header, ...body] = rows;

    if (renderedAny) pdf.addPage();
    renderedAny = true;

    pdf.setFontSize(12);
    pdf.text(name, 24, 24);

    autoTable(pdf, {
      head: [header.map((c) => (c == null ? "" : String(c)))],
      body: body.map((row) => row.map((c) => (c == null ? "" : String(c)))),
      startY: 34,
      styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak" },
      headStyles: { fillColor: [47, 111, 237], textColor: 255 },
      margin: { left: 24, right: 24 },
      theme: "grid",
    });

    onProgress?.(15 + Math.round(((sheetIdx + 1) / sheetNames.length) * 75));
  });

  if (!renderedAny) {
    pdf.text("Tidak ada data untuk ditampilkan.", 24, 24);
  }

  onProgress?.(100);
  return pdf.output("blob");
}
