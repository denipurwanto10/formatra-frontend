import { Info } from "lucide-react";

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
    <details className="group mb-4 rounded-2xl border-hair bg-surface transition-colors open:bg-surface-2/30">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2.5 px-4 py-3 text-[12.5px] font-semibold text-ink [&::-webkit-details-marker]:hidden">
        <Info className="size-4 text-accent" />
        Cara kerja
        <span className="ml-auto text-[11px] font-medium text-muted transition-transform group-open:rotate-180">⌄</span>
      </summary>
      <ol className="grid gap-2 border-t border-[var(--border)] px-4 py-3 sm:grid-cols-3">
        {steps.map((step, index) => (
          <li key={step} className="flex gap-2 text-[11.5px] leading-relaxed text-muted">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-accent/10 font-mono text-[10px] font-semibold text-accent">{index + 1}</span>
            {step}
          </li>
        ))}
      </ol>
    </details>
  );
}
