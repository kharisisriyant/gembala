import { Link } from "react-router-dom"
import {
  ArrowRight,
  BellRing,
  CalendarCheck,
  Check,
  HeartHandshake,
  Leaf,
  Lock,
  MessageCircle,
  ShieldCheck,
  Sprout,
  Tags,
  UserPlus,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ThemeToggle } from "@/components/theme-toggle"
import { useAuth } from "@/lib/auth"

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2">
      <div className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-lg">
        <Leaf className="size-5" />
      </div>
      <span className="text-lg font-bold">Gembala</span>
    </Link>
  )
}

function Nav() {
  const { me } = useAuth()

  return (
    <header className="bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6">
        <Logo />
        <nav className="text-muted-foreground hidden items-center gap-6 text-sm md:flex">
          <a href="#fitur" className="hover:text-foreground transition-colors">
            Fitur
          </a>
          <a href="#telegram" className="hover:text-foreground transition-colors">
            Asisten Telegram
          </a>
          <a href="#privasi" className="hover:text-foreground transition-colors">
            Privasi
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {me ? (
            <Button asChild>
              <Link to="/dashboard">Buka dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" className="hidden sm:inline-flex">
                <Link to="/login">Masuk</Link>
              </Button>
              <Button asChild>
                <Link to="/register">Daftar gratis</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

const previewMembers = [
  { initials: "BS", name: "Budi Santoso", status: "present" },
  { initials: "SW", name: "Sari Wijaya", status: "present" },
  { initials: "DN", name: "Dewi Natalia", status: "excused" },
  { initials: "AP", name: "Andi Pratama", status: "followup" },
] as const

function StatusBadge({ status }: { status: (typeof previewMembers)[number]["status"] }) {
  if (status === "present")
    return (
      <Badge variant="success">
        <Check /> Hadir
      </Badge>
    )
  if (status === "excused") return <Badge variant="muted">Izin</Badge>
  return (
    <Badge variant="warning">
      <BellRing /> Perlu dihubungi
    </Badge>
  )
}

function HeroPreview() {
  return (
    <Card className="gap-4 py-4" aria-hidden>
      <CardHeader className="px-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Komsel Pemuda · Jumat</CardTitle>
            <CardDescription>Jumat, 25 September 2026 · 19.00</CardDescription>
          </div>
          <div className="text-right">
            <div className="text-2xl font-semibold tabular-nums">86%</div>
            <div className="text-muted-foreground text-xs">kehadiran</div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4">
        <ul className="divide-y rounded-lg border">
          {previewMembers.map((m) => (
            <li key={m.name} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="flex items-center gap-3">
                <div className="bg-muted text-muted-foreground flex size-8 items-center justify-center rounded-full text-xs font-medium">
                  {m.initials}
                </div>
                <span className="text-sm">{m.name}</span>
              </div>
              <StatusBadge status={m.status} />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function Hero() {
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 md:grid-cols-2 md:px-6 md:py-24">
      <div>
        <Badge variant="outline" className="mb-4">
          <Sprout /> Untuk gereja dan komsel di Indonesia
        </Badge>
        <h1 className="text-4xl font-bold text-balance md:text-5xl">
          Gembalakan jemaat, bukan spreadsheet.
        </h1>
        <p className="text-muted-foreground mt-4 max-w-prose text-lg">
          Gembala membantu pemimpin gereja mencatat kehadiran komsel, mengenal setiap jemaat, dan
          tahu siapa yang perlu dihubungi minggu ini — dari browser atau langsung lewat Telegram.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg" className="h-11">
            <Link to="/register">
              Daftarkan gereja Anda <ArrowRight />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-11">
            <a href="#fitur">Lihat fitur</a>
          </Button>
        </div>
        <p className="text-muted-foreground mt-4 text-sm">
          Siap dipakai dalam 15 menit. Tanpa instalasi.
        </p>
      </div>
      <HeroPreview />
    </section>
  )
}

const features = [
  {
    icon: Users,
    title: "Data jemaat yang rapi",
    body: "Profil lengkap, foto, keluarga, dan riwayat kehadiran dalam satu tempat. Tamu tercatat sejak kunjungan pertama.",
  },
  {
    icon: CalendarCheck,
    title: "Kehadiran komsel dalam 3 menit",
    body: "Jadwal mingguan, dua mingguan, atau bulanan. Tandai hadir, izin, atau absen dengan satu ketukan.",
  },
  {
    icon: BellRing,
    title: "Tahu siapa yang perlu dihubungi",
    body: "Jemaat yang absen dua pertemuan berturut-turut otomatis muncul di daftar tindak lanjut.",
  },
  {
    icon: Tags,
    title: "Tag untuk pelayanan dan usia",
    body: "Kelompokkan jemaat sesuai struktur gereja Anda: pemuda, wilayah, pelayanan, apa saja.",
  },
  {
    icon: UserPlus,
    title: "Undang pemimpin dengan akses terbatas",
    body: "Setiap pemimpin hanya melihat jemaat yang menjadi tanggung jawabnya.",
  },
  {
    icon: HeartHandshake,
    title: "Catatan pastoral yang terjaga",
    body: "Catatan pribadi hanya terlihat oleh penulis dan gembala. Tidak pernah muncul di daftar atau ekspor.",
  },
]

function Features() {
  return (
    <section id="fitur" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 md:px-6 md:py-24">
      <div className="max-w-2xl">
        <h2 className="text-2xl font-semibold md:text-3xl">
          Semua yang dibutuhkan pemimpin untuk merawat jemaat
        </h2>
        <p className="text-muted-foreground mt-3 text-lg">
          Dirancang bersama pemimpin komsel, bukan untuk akuntan.
        </p>
      </div>
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {features.map(({ icon: Icon, title, body }) => (
          <Card key={title}>
            <CardHeader>
              <div className="bg-primary/10 text-primary mb-2 flex size-10 items-center justify-center rounded-md">
                <Icon className="size-5" />
              </div>
              <CardTitle className="text-lg">{title}</CardTitle>
              <CardDescription className="text-base">{body}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </section>
  )
}

function ChatBubble({ from, children }: { from: "me" | "bot"; children: React.ReactNode }) {
  const mine = from === "me"
  return (
    <div className={mine ? "flex justify-end" : "flex justify-start"}>
      <div
        className={
          mine
            ? "bg-primary/10 max-w-[85%] rounded-lg rounded-br-sm px-4 py-2.5 text-sm"
            : "bg-muted max-w-[85%] rounded-lg rounded-bl-sm px-4 py-2.5 text-sm"
        }
      >
        {children}
      </div>
    </div>
  )
}

function TelegramSection() {
  return (
    <section id="telegram" className="bg-card scroll-mt-20 border-y">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 md:grid-cols-2 md:px-6 md:py-24">
        <div>
          <Badge variant="info" className="mb-4">
            <MessageCircle /> Asisten AI di Telegram
          </Badge>
          <h2 className="text-2xl font-semibold md:text-3xl">
            Catat kehadiran semudah mengirim pesan
          </h2>
          <p className="text-muted-foreground mt-3 text-lg">
            Selesai komsel, cukup ketik siapa yang hadir. Asisten Gembala memahami bahasa sehari-hari,
            meminta konfirmasi sebelum menyimpan, dan menjawab pertanyaan tentang jemaat Anda.
          </p>
          <ul className="mt-6 flex flex-col gap-3">
            {[
              "Rekam kehadiran dan tambah tamu baru dari chat",
              "Tanya siapa yang sudah lama tidak datang",
              "Tulis catatan pastoral saat masih ingat",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3">
                <Check className="text-primary mt-0.5 size-5 shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <Card className="bg-background gap-3 p-4" aria-label="Contoh percakapan dengan asisten Gembala">
          <ChatBubble from="me">
            Kehadiran komsel pemuda hari ini: Budi, Sari, Dewi hadir. Andi izin, sakit.
          </ChatBubble>
          <ChatBubble from="bot">
            <p>Saya catat untuk <strong>Komsel Pemuda, Jumat 25 Sep</strong>:</p>
            <p className="mt-1">✓ Hadir: Budi Santoso, Sari Wijaya, Dewi Natalia</p>
            <p>– Izin: Andi Pratama (sakit)</p>
            <p className="mt-1">Simpan?</p>
          </ChatBubble>
          <ChatBubble from="me">Ya. Siapa yang belum datang 2 minggu terakhir?</ChatBubble>
          <ChatBubble from="bot">
            <p>2 jemaat perlu dihubungi:</p>
            <p className="mt-1">• Yosua Hutapea — absen 3 pertemuan</p>
            <p>• Maria Lestari — absen 2 pertemuan</p>
          </ChatBubble>
        </Card>
      </div>
    </section>
  )
}

function Privacy() {
  return (
    <section id="privasi" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 md:px-6 md:py-24">
      <div className="grid gap-10 md:grid-cols-2">
        <div>
          <div className="bg-primary/10 text-primary mb-4 flex size-10 items-center justify-center rounded-md">
            <ShieldCheck className="size-5" />
          </div>
          <h2 className="text-2xl font-semibold md:text-3xl">Data jemaat adalah titipan</h2>
          <p className="text-muted-foreground mt-3 text-lg">
            Setiap gereja punya ruang datanya sendiri yang terpisah. Pemimpin hanya melihat jemaat
            sesuai tag yang diberikan, dan semua perubahan tercatat.
          </p>
        </div>
        <div className="flex flex-col gap-4">
          {[
            {
              icon: Lock,
              title: "Terpisah per gereja",
              body: "Tidak ada gereja lain yang bisa melihat data Anda — termasuk tim Gembala.",
            },
            {
              icon: Tags,
              title: "Akses berdasarkan tag",
              body: "Pemimpin komsel pemuda hanya melihat jemaat pemuda. Tidak lebih.",
            },
            {
              icon: HeartHandshake,
              title: "Aman saat pemimpin berganti",
              body: "Akses dicabut seketika, data dan catatan tetap aman di tangan gereja.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="bg-muted flex gap-4 rounded-lg p-4">
              <Icon className="text-muted-foreground mt-0.5 size-5 shrink-0" />
              <div>
                <div className="font-semibold">{title}</div>
                <p className="text-muted-foreground text-sm">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Verse() {
  return (
    <section className="mx-auto max-w-prose px-4 py-12 text-center md:py-16">
      <blockquote className="font-serif text-xl italic md:text-2xl">
        “Aku mengenal domba-domba-Ku dan domba-domba-Ku mengenal Aku.”
      </blockquote>
      <p className="text-muted-foreground mt-3 text-sm not-italic">Yohanes 10:14</p>
    </section>
  )
}

function FinalCta() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-16 md:px-6 md:pb-24">
      <Card className="items-center px-6 py-12 text-center md:py-16">
        <h2 className="text-2xl font-semibold md:text-3xl">Mulai gembalakan dengan lebih baik</h2>
        <p className="text-muted-foreground max-w-prose text-lg">
          Buat akun gereja, tambahkan komsel pertama, dan catat pertemuan pertama Anda hari ini.
        </p>
        <Button asChild size="lg" className="h-11">
          <Link to="/register">
            Daftarkan gereja Anda <ArrowRight />
          </Link>
        </Button>
      </Card>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t">
      <div className="text-muted-foreground mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm md:flex-row md:px-6">
        <div className="flex items-center gap-2">
          <Leaf className="text-primary size-4" />
          <span>© {new Date().getFullYear()} Gembala</span>
        </div>
        <div className="flex gap-6">
          <Link to="/login" className="hover:text-foreground transition-colors">
            Masuk
          </Link>
          <Link to="/register" className="hover:text-foreground transition-colors">
            Daftar
          </Link>
        </div>
      </div>
    </footer>
  )
}

export function LandingPage() {
  return (
    <div className="min-h-dvh">
      <Nav />
      <main>
        <Hero />
        <Features />
        <TelegramSection />
        <Privacy />
        <Verse />
        <FinalCta />
      </main>
      <Footer />
    </div>
  )
}
