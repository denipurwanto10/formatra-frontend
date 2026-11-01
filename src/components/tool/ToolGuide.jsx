import { ChevronDown } from "lucide-react";

const GUIDES = {
  "merge-pdf": ["Pilih minimal 2 PDF.", "Seret file untuk menentukan urutan halaman.", "Klik Gabung lalu unduh hasilnya."],
  "compress-pdf": ["Pilih tingkat kompresi sesuai kebutuhan.", "Mode seimbang/kuat merasterisasi halaman.", "Periksa ukuran hasil sebelum mengunduh."],
  "split-pdf": ["Unggah satu PDF dan tunggu jumlah halaman terbaca.", "Pilih rentang halaman atau pisahkan setiap halaman.", "Unduh hasil satuan atau ZIP."],
  "protect-pdf": ["Pilih PDF yang ingin dikunci.", "Gunakan kata sandi yang mudah kamu simpan dengan aman.", "Atur izin cetak dan salin sebelum mengunci."],
  "ocr-pdf": ["Unggah PDF hasil scan.", "Pilih bahasa yang terdapat di dokumen.", "Jalankan OCR lalu unduh PDF yang dapat dicari."],
  "pdf-to-word": ["Unggah PDF dengan teks yang ingin diedit.", "Tunggu proses ekstraksi selesai.", "Unduh DOCX dan periksa kembali layout hasil."],
  "word-to-pdf": ["Unggah file DOCX.", "Tunggu dokumen dirender di browser.", "Unduh PDF hasil konversi."],
};

export default function ToolGuide({ toolId }) {
  const steps = GUIDES[toolId];
  if (!steps) return null;

  return (
    <details className="group mb-4 overflow-hidden rounded-[14px] border-hair bg-surface">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2.5 px-4 py-3 text-[13px] font-medium text-ink transition-colors hover:bg-surface-2/60 [&::-webkit-details-marker]:hidden">
        Cara kerja
        <ChevronDown className="ml-auto size-4 text-muted transition-transform duration-300 ease-[var(--ease-out)] group-open:rotate-180" />
      </summary>
      <ol className="animate-fade-in grid gap-3 border-t border-hair px-4 py-4 sm:grid-cols-3">
        {steps.map((step, index) => (
          <li key={step} className="flex gap-2.5 text-[12.5px] leading-relaxed text-muted">
            <span className="mt-px font-mono text-[11px] text-ink">{String(index + 1).padStart(2, "0")}</span>
            {step}
          </li>
        ))}
      </ol>
    </details>
  );
}
