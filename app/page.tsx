import Link from 'next/link'
import {
  ArrowRight,
  Clock,
  MessageSquareOff,
  FileWarning,
  Users2,
  Sparkles,
  Zap,
  ClipboardCheck,
  BarChart3,
  ShieldCheck,
  CalendarClock,
  Bot,
} from 'lucide-react'

export const metadata = {
  title: 'Greenly Staffing — Rekrutmen Outlet Tanpa Drama',
  description:
    'Agent AI yang menyaring, membalas, dan menjadwalkan kandidat rekrutmen outlet Anda — HR tinggal review dan setujui.',
}

const painPoints = [
  {
    icon: FileWarning,
    title: 'CV Menumpuk, Tak Sempat Disaring',
    desc: 'Ratusan lamaran masuk tiap buka outlet baru, tapi tim HR cuma sempat baca segelintir sebelum kandidat terbaik keburu diambil kompetitor.',
  },
  {
    icon: MessageSquareOff,
    title: 'Follow-up Kandidat Sering Kelewat',
    desc: 'Kandidat yang tertarik tidak dibalas tepat waktu, akhirnya hilang minat atau sudah keburu kerja di tempat lain.',
  },
  {
    icon: Clock,
    title: 'Proses Manual dari Awal sampai Akhir',
    desc: 'Screening, chat WA satu-satu, jadwalkan interview, catat hasil — semua dikerjakan manual dan gampang tercecer di spreadsheet berbeda-beda.',
  },
  {
    icon: Users2,
    title: 'Sulit Tahu Kandidat Mana yang Prioritas',
    desc: 'Tanpa skor yang jelas, HR menghabiskan waktu sama rata ke semua kandidat — padahal tidak semua punya peluang sukses yang sama.',
  },
]

const solutions = [
  {
    icon: Bot,
    title: 'Agent AI Menyaring & Menskor Otomatis',
    desc: 'Setiap CV yang masuk langsung dianalisis dan diberi skor kecocokan serta estimasi peluang sukses — HR fokus ke kandidat yang paling menjanjikan.',
  },
  {
    icon: Sparkles,
    title: 'Draft Pesan Otomatis, HR Tinggal Setujui',
    desc: 'Agent menyusun draft outreach, balasan, dan undangan interview secara otomatis. HR cukup review dan klik setujui — tidak ada pesan yang terkirim tanpa persetujuan manusia.',
  },
  {
    icon: CalendarClock,
    title: 'Pipeline Interview Terstruktur',
    desc: 'Dari tertarik → jadwal interview → keputusan lulus/tidak, semua tahapan tercatat rapi dengan catatan hasil interview di satu tempat.',
  },
  {
    icon: BarChart3,
    title: 'Dashboard & Outcome Tracking',
    desc: 'Pantau performa perekrutan, funnel kandidat, dan hasil onboarding secara real-time — bukan lagi tebak-tebak dari spreadsheet terpisah.',
  },
]

const benefits = [
  { icon: Zap, title: 'Respons Lebih Cepat', desc: 'Kandidat potensial dibalas dalam hitungan menit, bukan hari.' },
  { icon: ClipboardCheck, title: 'HR Tetap Pegang Kendali', desc: 'Semua pesan agent melewati approval HR sebelum terkirim ke kandidat.' },
  { icon: Users2, title: 'Kualitas Rekrutmen Naik', desc: 'Skor kecocokan membantu prioritaskan kandidat dengan peluang sukses tertinggi.' },
  { icon: ShieldCheck, title: 'Semua Tercatat Rapi', desc: 'Riwayat chat, keputusan interview, hingga performa onboarding tersimpan otomatis.' },
]

export default function LandingPage() {
  // In demo mode there's no real Supabase auth user to log in with — middleware
  // already lets anyone straight through to /dashboard, so sending CTAs to
  // /login here would just dead-end on a login form nobody has credentials for.
  const ctaHref = process.env.DEMO_MODE === 'true' ? '/dashboard' : '/login'

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="sticky top-0 z-20 border-b border-black/5 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2 font-bold text-[#1E3A2F]">
            <div className="flex size-8 items-center justify-center rounded-lg bg-[#1E3A2F] text-white text-sm">G</div>
            Greenly Staffing
          </div>
          <Link
            href={ctaHref}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1E3A2F] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#2d5242]"
          >
            Masuk <ArrowRight size={14} />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-[#1E3A2F]">
        <div className="absolute inset-0 opacity-[0.07] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:22px_22px]" />
        <div className="relative mx-auto max-w-6xl px-6 py-24 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80">
            <Sparkles size={12} /> Ditenagai Agent AI
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold leading-tight text-white sm:text-5xl">
            Rekrutmen Outlet Cloud Kitchen, Tanpa Drama.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-white/70 sm:text-lg">
            Agent AI menyaring CV, membalas kandidat, dan menjadwalkan interview untuk Anda.
            Tim HR tinggal review dan tekan setuju.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link
              href={ctaHref}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-[#1E3A2F] transition-colors hover:bg-white/90"
            >
              Masuk ke Dashboard <ArrowRight size={15} />
            </Link>
            <Link
              href="#solusi"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/25 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              Lihat Cara Kerjanya
            </Link>
          </div>
        </div>
      </section>

      {/* Pain points */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[#1E3A2F]">Masalahnya</h2>
          <p className="mt-2 text-2xl font-bold text-gray-900 sm:text-3xl">
            Rekrutmen manual tidak lagi cukup cepat
          </p>
          <p className="mt-3 text-sm text-gray-500">
            Setiap outlet baru berarti lonjakan lamaran — dan HR yang kewalahan berisiko kehilangan kandidat terbaik.
          </p>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2">
          {painPoints.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex gap-4 rounded-xl border border-gray-100 bg-gray-50/60 p-5">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-500">
                <Icon size={18} />
              </div>
              <div>
                <p className="font-semibold text-gray-900">{title}</p>
                <p className="mt-1 text-sm text-gray-500">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Solution */}
      <section id="solusi" className="bg-gray-50/70 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[#1E3A2F]">Solusinya</h2>
            <p className="mt-2 text-2xl font-bold text-gray-900 sm:text-3xl">
              Satu agent, satu pipeline, dari lamaran sampai direkrut
            </p>
            <p className="mt-3 text-sm text-gray-500">
              Greenly Staffing menjalankan proses rekrutmen ujung ke ujung — HR tetap yang memegang keputusan akhir.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2">
            {solutions.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
                <div className="flex size-10 items-center justify-center rounded-lg bg-[#1E3A2F]/10 text-[#1E3A2F]">
                  <Icon size={18} />
                </div>
                <p className="mt-4 font-semibold text-gray-900">{title}</p>
                <p className="mt-1.5 text-sm text-gray-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[#1E3A2F]">Alurnya</h2>
          <p className="mt-2 text-2xl font-bold text-gray-900 sm:text-3xl">Dari kandidat masuk sampai direkrut</p>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-0 sm:grid-cols-5">
          {[
            'Kandidat Masuk',
            'Agent Menskor & Membalas',
            'HR Menyetujui Pesan',
            'Interview Dijadwalkan',
            'Lulus & Direkrut',
          ].map((step, i, arr) => (
            <div key={step} className="relative flex flex-col items-center px-3 text-center">
              <div className="flex size-9 items-center justify-center rounded-full bg-[#1E3A2F] text-sm font-semibold text-white">
                {i + 1}
              </div>
              <p className="mt-3 text-sm font-medium text-gray-800">{step}</p>
              {i < arr.length - 1 && (
                <div className="absolute right-0 top-4.5 hidden h-px w-1/2 translate-x-1/2 bg-gray-200 sm:block" />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section className="bg-[#1E3A2F] py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-white/60">Manfaatnya</h2>
            <p className="mt-2 text-2xl font-bold text-white sm:text-3xl">Kenapa tim HR pakai Greenly Staffing</p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-xl bg-white/5 p-5">
                <div className="flex size-9 items-center justify-center rounded-lg bg-white/10 text-white">
                  <Icon size={16} />
                </div>
                <p className="mt-3 text-sm font-semibold text-white">{title}</p>
                <p className="mt-1 text-xs text-white/60">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-6 py-20 text-center">
        <p className="text-2xl font-bold text-gray-900 sm:text-3xl">Siap percepat rekrutmen outlet Anda?</p>
        <p className="mx-auto mt-3 max-w-md text-sm text-gray-500">
          Masuk ke dashboard dan biarkan agent menangani screening awal, HR fokus di keputusan akhir.
        </p>
        <Link
          href={ctaHref}
          className="mt-7 inline-flex items-center gap-1.5 rounded-lg bg-[#1E3A2F] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#2d5242]"
        >
          Masuk ke Dashboard <ArrowRight size={15} />
        </Link>
      </section>

      <footer className="border-t border-gray-100 py-8 text-center text-xs text-gray-400">
        © {new Date().getFullYear()} Greenly Staffing — Greenly Cloud Kitchen
      </footer>
    </div>
  )
}
