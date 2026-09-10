import mammoth from "mammoth";
import { renderAsync } from "docx-preview";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { htmlToPdfBlob } from "./htmlToPdf";
import { convertViaBackend, BackendUnavailableError } from "./backendConvert";

export async function wordToPdf(file, onProgress) {
  try {
    const blob = await convertViaBackend({
      file,
      route: "/api/convert/word-to-pdf",
      mimeType: "application/pdf",
      onProgress,
    });
    return { blob, warnings: [] };
  } catch (err) {
    if (!(err instanceof BackendUnavailableError)) throw err;
    // No server configured/reachable — fall back to the in-browser converter.
  }

  try {
    return await wordToPdfHighFidelity(file, onProgress);
  } catch (err) {
    // docx-preview couldn't parse this particular file (unusual/corrupt
    // section properties, very old format quirks, etc). Rather than failing
    // the whole conversion, fall back to the older, simpler renderer — it
    // looks less like the original but still gets the text out.
    console.error("Rendering with layout fidelity failed, using simplified fallback:", err);
    const result = await wordToPdfSimplified(file, onProgress);
    return {
      ...result,
      warnings: [
        {
          type: "warning",
          message: "Tata letak asli tidak bisa direplikasi sepenuhnya untuk file ini; dipakai mode konversi sederhana.",
        },
        ...(result.warnings || []),
      ],
    };
  }
}

/**
 * High-fidelity path: render the .docx into real page-shaped HTML with
 * docx-preview (the same class of engine Word-viewer clones use — it keeps
 * fonts, margins, page size, headers/footers, tables and images intact),
 * then rasterize each rendered page 1:1 into its own same-sized PDF page.
 * This keeps the PDF visually close to what Word itself would show, unlike
 * a plain HTML reflow which loses layout entirely.
 */
async function wordToPdfHighFidelity(file, onProgress) {
  const arrayBuffer = await file.arrayBuffer();
  onProgress?.(5);

  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.top = "0";
  container.style.left = "-99999px";
  document.body.appendChild(container);

  try {
    await renderAsync(arrayBuffer, container, container, {
      inWrapper: true,
      breakPages: true,
      useBase64URL: true, // avoids leaking blob: URLs we'd otherwise have to revoke
      ignoreLastRenderedPageBreak: false,
    });
    onProgress?.(25);

    const pages = container.querySelectorAll(".docx-wrapper > section.docx");
    if (!pages.length) {
      throw new Error("Dokumen tidak menghasilkan halaman yang bisa dirender.");
    }

    const PX_TO_MM = 25.4 / 96;
    const SCALE = 2; // supersample for crisper text in the rasterized PDF
    let pdf;

    for (let i = 0; i < pages.length; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const canvas = await html2canvas(pages[i], {
        scale: SCALE,
        useCORS: true,
        backgroundColor: "#ffffff",
      });
      const widthMm = (canvas.width / SCALE) * PX_TO_MM;
      const heightMm = (canvas.height / SCALE) * PX_TO_MM;
      const imgData = canvas.toDataURL("image/jpeg", 0.95);

      if (!pdf) {
        pdf = new jsPDF({ unit: "mm", format: [widthMm, heightMm] });
      } else {
        pdf.addPage([widthMm, heightMm]);
      }
      pdf.addImage(imgData, "JPEG", 0, 0, widthMm, heightMm);
      onProgress?.(25 + Math.round(((i + 1) / pages.length) * 70));
    }

    onProgress?.(100);
    return { blob: pdf.output("blob"), warnings: [] };
  } finally {
    document.body.removeChild(container);
  }
}

/** Older, simpler renderer kept only as a last-resort fallback: strips the
 * document down to plain flowing HTML (headings/paragraphs/tables/lists),
 * with no original fonts, page size, images, or exact spacing preserved. */
async function wordToPdfSimplified(file, onProgress) {
  const arrayBuffer = await file.arrayBuffer();
  onProgress?.(5);
  const { value: html, messages } = await mammoth.convertToHtml(
    { arrayBuffer },
    {
      styleMap: [
        "p[style-name='Title'] => h1:fresh",
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
      ],
    }
  );
  onProgress?.(15);

  const wrapped = `
    <style>
      h1 { font-size: 20px; margin: 0 0 12px; font-weight: 700; }
      h2 { font-size: 16px; margin: 18px 0 8px; font-weight: 700; }
      h3 { font-size: 14px; margin: 14px 0 6px; font-weight: 700; }
      p { margin: 0 0 10px; }
      table { border-collapse: collapse; width: 100%; margin-bottom: 12px; }
      td, th { border: 1px solid #999; padding: 4px 6px; font-size: 12px; }
      img { max-width: 100%; }
      ul, ol { margin: 0 0 10px 22px; }
    </style>
    ${html}
  `;

  const blob = await htmlToPdfBlob(wrapped, (p) => onProgress?.(15 + p * 0.85));
  return { blob, warnings: messages?.filter((m) => m.type === "warning") || [] };
}
