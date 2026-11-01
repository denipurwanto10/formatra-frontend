// Client-side PDF to Excel conversion (table extraction) using pdf.js for
// parsing and SheetJS (xlsx) for Excel generation. Since we're in the browser,
// this can only extract table-like structures from text-based PDFs (not images).

import { loadPdfDocument } from "../../lib/pdfjs";
import * as XLSX from "xlsx";

/**
 * Extracts tables from a PDF and converts them to Excel format.
 * Note: This is a basic implementation that looks for table-like text patterns.
 * For complex layouts or scanned documents, accuracy may vary.
 * 
 * @param {File} file - The PDF file to convert
 * @param {object} options - Options for the conversion
 * @param {Function} [onProgress] - Progress callback function
 * @returns {Promise<Blob>} - The resulting Excel file as a Blob
 */
export async function pdfToExcel(file, options = {}, onProgress) {
  onProgress?.(5);

  const pdfDoc = await loadPdfDocument(file);
  const totalPages = pdfDoc.numPages;
  if (!totalPages) throw new Error("PDF tidak memiliki halaman yang bisa diekstrak.");
  const workbook = XLSX.utils.book_new();
  
  // Process each page
  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    onProgress?.(Math.min(90, 10 + Math.floor((pageNum / totalPages) * 80)));
    
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();
    
    // Group text items by lines based on their vertical position
    const lines = {};
    textContent.items.forEach(item => {
      // Round y-coordinate to group items that are approximately on the same line
      const y = Math.round(item.transform[5]);
      if (!lines[y]) {
        lines[y] = [];
      }
      lines[y].push({
        str: item.str,
        x: item.transform[4], // x-coordinate
        width: item.width
      });
    });
    
    // Sort lines by y-coordinate (top to bottom)
    const sortedYs = Object.keys(lines).map(Number).sort((a, b) => b - a);
    
    // Sort each line's items by x-coordinate (left to right)
    const tableRows = sortedYs.map(y => {
      return lines[y].sort((a, b) => a.x - b.x).map(item => item.str);
    });
    
    // Create worksheet for this page
    const worksheet = XLSX.utils.aoa_to_sheet(tableRows);
    const sheetName = `Page ${pageNum}`;
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  }
  
  // Generate Excel file
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  onProgress?.(100);
  
  return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}