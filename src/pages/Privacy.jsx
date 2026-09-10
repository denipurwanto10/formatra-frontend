import { Link } from "react-router-dom";
import { ArrowLeft, FileStack, ShieldCheck, ServerOff, Database } from "lucide-react";
import ThemeToggle from "../components/ThemeToggle";

const POINTS = [
  {
    icon: ServerOff,
    title: "File diproses di browser",
    desc: "Setiap konversi, kompresi, dan proses edit dijalankan dengan JavaScript langsung di perangkat Anda. File tidak dikirim ke server kami.",
  },
  {
    icon: ShieldCheck,
    title: "Privat",
    desc: "File diproses langsung di perangkat Anda dan tidak dikirim ke server kami.",
  },
  {
    icon: ShieldCheck,
    title: "Tidak diunggah ke server",
    desc: "Karena pemrosesan sepenuhnya berjalan di sisi klien, tidak ada salinan file Anda yang transit atau tersimpan di infrastruktur kami.",
  },
  {
    icon: Database,
    title: "Riwayat aktivitas bersifat lokal",
    desc: "Fitur \"Aktivitas Terbaru\" hanya menyimpan nama tool, nama file, dan waktu proses di localStorage perangkat Anda sendiri — bukan isi file. Anda dapat menghapusnya kapan saja dari Dashboard.",
  },
];

export default function Privacy() {
  return (
    <div className="min-h-screen bg-base text-ink">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 lg:px-8">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="relative flex size-8 items-center justify-center rounded-xl bg-accent text-accent-ink">
            <FileStack className="size-[18px]" />
            <span className="absolute -right-1 -top-1 size-2.5 rounded-full bg-[var(--coral)]" aria-hidden="true" />
          </div>
          <span className="font-display text-[16px] font-semibold tracking-tight">Formatra</span>
        </Link>
        <ThemeToggle />
      </header>

      <main className="mx-auto max-w-2xl px-5 py-10 lg:px-8">
        <Link to="/" className="mb-6 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
          <ArrowLeft className="size-3.5" />
          Kembali
        </Link>

        <h1 className="text-2xl font-semibold tracking-tight text-ink">Privasi</h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
          Formatra dibangun dengan prinsip client-side processing: file Anda tidak pernah
          meninggalkan perangkat Anda selama digunakan.
        </p>

        <div className="mt-8 flex flex-col gap-5">
          {POINTS.map((p) => (
            <div key={p.title} className="flex gap-3.5">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-2 text-accent">
                <p.icon className="size-[18px]" />
              </div>
              <div>
                <p className="text-[13.5px] font-medium text-ink">{p.title}</p>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{p.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-lg border-hair bg-surface-2 p-4">
          <p className="text-[12.5px] leading-relaxed text-muted">
            Catatan: beberapa tool (mis. OCR) mengunduh model bahasa dari jaringan pengiriman
            konten pihak ketiga saat pertama kali digunakan agar dapat berjalan di browser Anda —
            ini adalah unduhan model, bukan pengunggahan file Anda.
          </p>
        </div>
      </main>
    </div>
  );
}
