import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck, ServerOff, Database, Lock } from "lucide-react";
import ThemeToggle from "../components/ThemeToggle";
import Logo from "../components/ui/Logo";
import Reveal from "../components/ui/Reveal";

const POINTS = [
  {
    icon: ServerOff,
    title: "File diproses di browser",
    desc: "Setiap konversi, kompresi, dan proses edit dijalankan dengan JavaScript langsung di perangkat Anda. File tidak dikirim ke server kami.",
  },
  {
    icon: Lock,
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
    <div className="page-enter min-h-dvh bg-base text-ink">
      <header className="px-5 lg:px-8">
        <div className="mx-auto flex h-16 max-w-[1160px] items-center justify-between">
          <Link to="/" aria-label="Formatra — beranda"><Logo /></Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 pb-24 pt-8 sm:pt-14 lg:px-8">
        <Link to="/" className="group mb-8 inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-ink">
          <ArrowLeft className="size-3.5 transition-transform duration-300 ease-[var(--ease-out)] group-hover:-translate-x-0.5" />
          Kembali
        </Link>

        <p className="animate-fade-up section-label">Kebijakan</p>
        <h1 className="animate-fade-up mt-2 text-[2.2rem] font-semibold leading-tight tracking-[-0.04em] sm:text-[2.8rem]" style={{ animationDelay: "60ms" }}>
          Privasi
        </h1>
        <p className="animate-fade-up mt-4 text-[15.5px] leading-[1.7] text-muted" style={{ animationDelay: "120ms" }}>
          Formatra dibangun dengan prinsip client-side processing: file Anda tidak pernah meninggalkan perangkat Anda selama digunakan.
        </p>

        <div className="mt-12 flex flex-col divide-y divide-[var(--border)] border-y border-hair">
          {POINTS.map((p, i) => (
            <Reveal key={p.title} delay={i * 60} className="flex gap-4 py-6">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-[9px] bg-surface-2 text-ink">
                <p.icon className="size-[17px]" strokeWidth={1.7} />
              </div>
              <div>
                <p className="text-[15px] font-medium tracking-[-0.01em] text-ink">{p.title}</p>
                <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{p.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-8 rounded-[14px] bg-surface-2 p-5">
          <p className="text-[13.5px] leading-relaxed text-muted">
            Catatan: beberapa tool (mis. OCR) mengunduh model bahasa dari jaringan pengiriman konten pihak ketiga saat pertama kali digunakan agar dapat berjalan di browser Anda — ini adalah unduhan model, bukan pengunggahan file Anda.
          </p>
        </Reveal>
      </main>
    </div>
  );
}
