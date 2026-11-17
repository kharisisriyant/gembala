import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import {
  ArrowRight,
  BellRing,
  Cake,
  CalendarCheck,
  CalendarDays,
  Check,
  ClipboardList,
  Church,
  HandHeart,
  HandHelping,
  HeartHandshake,
  Lock,
  MessageCircle,
  Music,
  Route,
  ShieldCheck,
  Sprout,
  Tags,
  Users,
  UsersRound,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ThemeToggle } from "@/components/theme-toggle"
import { LegalLinks } from "@/components/legal-links"
import { LanguageToggle } from "@/components/language-toggle"
import { HillsFooter, LoneSheep, PastureScene } from "@/components/landing-illustrations"
import { useAuth } from "@/lib/auth"

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2">
      <img src="/logo.png" alt="" className="size-9 object-contain" />
      <span className="text-lg font-bold">gembala</span>
    </Link>
  )
}

function Nav() {
  const { t } = useTranslation("landing")
  const { me } = useAuth()

  return (
    <header className="bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6">
        <Logo />
        <nav className="text-muted-foreground hidden items-center gap-6 text-sm md:flex">
          <a href="#fitur" className="hover:text-foreground transition-colors">
            {t("nav.fitur")}
          </a>
          <a href="#telegram" className="hover:text-foreground transition-colors">
            {t("nav.telegram")}
          </a>
          <a href="#privasi" className="hover:text-foreground transition-colors">
            {t("nav.privasi")}
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <ThemeToggle />
          {me ? (
            <Button asChild>
              <Link to="/dashboard">{t("nav.openDashboard")}</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" className="hidden sm:inline-flex">
                <Link to="/login">{t("nav.signIn")}</Link>
              </Button>
              <Button asChild>
                <a href="mailto:kharisisriyant@gmail.com">{t("nav.signUpFree")}</a>
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
  const { t } = useTranslation("landing")
  if (status === "present")
    return (
      <Badge variant="success">
        <Check /> {t("preview.status.present")}
      </Badge>
    )
  if (status === "excused") return <Badge variant="muted">{t("preview.status.excused")}</Badge>
  return (
    <Badge variant="warning">
      <BellRing /> {t("preview.status.followup")}
    </Badge>
  )
}

function FloatingChip({
  icon: Icon,
  className,
  children,
}: {
  icon: typeof Cake
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={`bg-card motion-safe:animate-float absolute z-10 flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium shadow-lg ${className ?? ""}`}
    >
      <Icon className="size-4" />
      <span className="text-foreground">{children}</span>
    </div>
  )
}

const dotGrid =
  "bg-[radial-gradient(circle,var(--border)_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]"

function HeroPreview() {
  const { t } = useTranslation("landing")
  return (
    <div className="relative" aria-hidden>
      <div className="from-primary/30 to-info/30 absolute -inset-6 rounded-[2.5rem] bg-linear-to-br blur-3xl" />
      <FloatingChip icon={Cake} className="text-warning-foreground -top-5 left-2 md:-left-6">
        {t("preview.chipBirthday")}
      </FloatingChip>
      <FloatingChip
        icon={CalendarCheck}
        className="text-primary right-2 -bottom-5 [animation-delay:-3s] md:-right-4"
      >
        {t("preview.chipRoster")}
      </FloatingChip>
      <Card className="relative gap-4 py-4 shadow-xl md:rotate-1">
        <CardHeader className="px-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">{t("preview.groupName")}</CardTitle>
              <CardDescription>{t("preview.dateTime")}</CardDescription>
            </div>
            <div className="text-right">
              <div className="text-2xl font-semibold tabular-nums">86%</div>
              <div className="text-muted-foreground text-xs">{t("preview.attendanceLabel")}</div>
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
    </div>
  )
}

function Hero() {
  const { t } = useTranslation("landing")
  return (
    <section className="relative overflow-hidden">
      <div className={`absolute inset-0 -z-10 ${dotGrid}`} />
      <div className="bg-primary/20 absolute -top-32 -left-32 -z-10 size-96 rounded-full blur-3xl" />
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 pt-16 pb-10 md:grid-cols-2 md:px-6 md:pt-24">
        <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-700">
          <Badge variant="outline" className="bg-card mb-4">
            <Sprout /> {t("hero.badge")}
          </Badge>
          <h1 className="from-foreground to-primary bg-linear-to-br from-40% bg-clip-text text-4xl font-bold text-balance text-transparent md:text-6xl">
            {t("hero.title")}
          </h1>
          <p className="text-muted-foreground mt-4 max-w-prose text-lg">{t("hero.body")}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="shadow-primary/30 group h-11 shadow-lg">
              <a href="mailto:kharisisriyant@gmail.com">
                {t("hero.cta")}{" "}
                <ArrowRight className="transition-transform group-hover:translate-x-1" />
              </a>
            </Button>
            <Button asChild size="lg" variant="outline" className="bg-card h-11">
              <a href="#telegram">{t("hero.ctaSecondary")}</a>
            </Button>
          </div>
          <p className="text-muted-foreground mt-4 text-sm">{t("hero.note")}</p>
        </div>
        <HeroPreview />
      </div>
      <PastureScene className="h-44 md:h-64" />
    </section>
  )
}

function PainPoints() {
  const { t } = useTranslation("landing")
  return (
    <section className="bg-card border-b">
      <div className="mx-auto max-w-3xl px-4 pt-6 pb-12 text-center md:px-6 md:pb-16">
        <p className="text-lg text-balance md:text-xl">{t("pain.body")}</p>
        <p className="text-primary mt-4 font-serif text-3xl italic md:text-4xl">
          {t("pain.question")}
        </p>
      </div>
    </section>
  )
}

const features = [
  { key: "members", icon: Users },
  { key: "scheduling", icon: CalendarCheck },
  { key: "worship", icon: Music },
  { key: "events", icon: CalendarDays },
  { key: "groups", icon: UsersRound },
  { key: "care", icon: HandHeart },
  { key: "journey", icon: Route },
  { key: "notes", icon: HeartHandshake },
] as const

const iconTones = [
  "bg-primary/10 text-primary",
  "bg-info-soft text-info",
  "bg-chart-3/10 text-chart-3",
  "bg-chart-4/10 text-chart-4",
]

const liftCard =
  "transition duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/40"

function Features() {
  const { t } = useTranslation("landing")
  return (
    <section id="fitur" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 md:px-6 md:py-24">
      <div className="max-w-2xl">
        <h2 className="text-2xl font-semibold md:text-3xl">{t("features.title")}</h2>
        <p className="text-muted-foreground mt-3 text-lg">{t("features.subtitle")}</p>
      </div>
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {features.map(({ key, icon: Icon }, i) => (
          <Card key={key} className={`group ${liftCard}`}>
            <CardHeader>
              <div
                className={`mb-2 flex size-11 items-center justify-center rounded-xl transition-transform group-hover:scale-110 group-hover:-rotate-6 ${iconTones[i % iconTones.length]}`}
              >
                <Icon className="size-5" />
              </div>
              <CardTitle className="text-lg">{t(`features.items.${key}.title`)}</CardTitle>
              <CardDescription className="text-base">
                {t(`features.items.${key}.body`)}
              </CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </section>
  )
}

const personas = [
  { key: "pastor", icon: Church },
  { key: "admin", icon: ClipboardList },
  { key: "coordinator", icon: CalendarCheck },
  { key: "volunteer", icon: HandHelping },
] as const

function Personas() {
  const { t } = useTranslation("landing")
  return (
    <section className="mx-auto max-w-6xl px-4 pb-16 md:px-6 md:pb-24">
      <div>
        <h2 className="max-w-2xl text-2xl font-semibold md:text-3xl">{t("personas.title")}</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {personas.map(({ key, icon: Icon }) => (
            <Card key={key} className={`from-primary/5 bg-linear-to-b to-transparent ${liftCard}`}>
              <CardHeader>
                <div className="bg-primary text-primary-foreground mb-2 flex size-11 items-center justify-center rounded-full">
                  <Icon className="size-5" />
                </div>
                <CardDescription>{t(`personas.items.${key}.role`)}</CardDescription>
                <CardTitle className="text-lg">{t(`personas.items.${key}.message`)}</CardTitle>
                <p className="text-muted-foreground pt-1 text-sm line-through decoration-destructive/50">
                  {t(`personas.items.${key}.worry`)}
                </p>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

const steps = ["invite", "setup", "log"] as const

function HowItWorks() {
  const { t } = useTranslation("landing")
  return (
    <section className="mx-auto max-w-6xl px-4 pb-16 md:px-6 md:pb-24">
      <h2 className="text-center text-2xl font-semibold md:text-3xl">{t("how.title")}</h2>
      <ol className="relative mt-12 grid gap-10 md:grid-cols-3">
        <div
          className="border-primary/40 absolute top-7 right-[16.6%] left-[16.6%] hidden border-t-2 border-dashed md:block"
          aria-hidden
        />
        {steps.map((key, i) => (
          <li key={key} className="relative flex flex-col items-center text-center">
            <div className="bg-primary text-primary-foreground ring-background flex size-14 items-center justify-center rounded-full font-mono text-xl font-bold shadow-lg ring-8">
              {i + 1}
            </div>
            <h3 className="mt-4 text-lg font-semibold">{t(`how.steps.${key}.title`)}</h3>
            <p className="text-muted-foreground mt-1 max-w-xs">{t(`how.steps.${key}.body`)}</p>
          </li>
        ))}
      </ol>
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
            ? "bg-primary text-primary-foreground max-w-[85%] rounded-2xl rounded-br-sm px-4 py-2.5 text-sm shadow-sm"
            : "bg-muted max-w-[85%] rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm"
        }
      >
        {children}
      </div>
    </div>
  )
}

function TelegramSection() {
  const { t } = useTranslation("landing")
  const listItems = [
    t("telegramSection.list.log"),
    t("telegramSection.list.ask"),
    t("telegramSection.list.notes"),
  ]
  return (
    <section id="telegram" className="bg-card relative scroll-mt-20 overflow-hidden border-y">
      <div
        className="bg-info/15 absolute -right-24 -bottom-24 size-96 rounded-full blur-3xl"
        aria-hidden
      />
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 md:grid-cols-2 md:px-6 md:py-24">
        <div>
          <Badge variant="info" className="mb-4">
            <MessageCircle /> {t("telegramSection.badge")}
          </Badge>
          <h2 className="text-2xl font-semibold md:text-3xl">{t("telegramSection.title")}</h2>
          <p className="text-muted-foreground mt-3 text-lg">{t("telegramSection.body")}</p>
          <ul className="mt-6 flex flex-col gap-3">
            {listItems.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <Check className="text-primary mt-0.5 size-5 shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div
          className="bg-background mx-auto flex w-full max-w-sm flex-col gap-3 rounded-4xl border-8 border-foreground/85 p-4 shadow-2xl md:-rotate-2"
          role="img"
          aria-label={t("telegramSection.chat.ariaLabel")}
        >
          <div className="flex items-center gap-3 border-b pb-3">
            <img src="/logo.png" alt="" className="size-8 object-contain" />
            <div>
              <div className="text-sm font-semibold">gembala</div>
              <div className="text-primary flex items-center gap-1 text-xs">
                <span className="bg-primary size-1.5 rounded-full motion-safe:animate-pulse" />
                {t("telegramSection.badge")}
              </div>
            </div>
          </div>
          <ChatBubble from="me">{t("telegramSection.chat.me1")}</ChatBubble>
          <ChatBubble from="bot">
            <p>
              {t("telegramSection.chat.bot1Prefix")}{" "}
              <strong>{t("telegramSection.chat.bot1Group")}</strong>:
            </p>
            <p className="mt-1">{t("telegramSection.chat.bot1Present")}</p>
            <p>{t("telegramSection.chat.bot1Excused")}</p>
            <p className="mt-1">{t("telegramSection.chat.bot1Confirm")}</p>
          </ChatBubble>
          <ChatBubble from="me">{t("telegramSection.chat.me2")}</ChatBubble>
          <ChatBubble from="bot">
            <p>{t("telegramSection.chat.bot2Intro")}</p>
            <p className="mt-1">{t("telegramSection.chat.bot2Item1")}</p>
            <p>{t("telegramSection.chat.bot2Item2")}</p>
          </ChatBubble>
        </div>
      </div>
    </section>
  )
}

const privacyItems = [
  { key: "isolated", icon: Lock },
  { key: "tags", icon: Tags },
  { key: "safe", icon: HeartHandshake },
] as const

function Privacy() {
  const { t } = useTranslation("landing")
  return (
    <section id="privasi" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 md:px-6 md:py-24">
      <div className="grid gap-10 md:grid-cols-2">
        <div>
          <div className="bg-primary/10 text-primary ring-primary/5 mb-6 flex size-16 items-center justify-center rounded-2xl ring-8">
            <ShieldCheck className="size-8" />
          </div>
          <h2 className="text-2xl font-semibold md:text-3xl">{t("privacy.title")}</h2>
          <p className="text-muted-foreground mt-3 text-lg">{t("privacy.body")}</p>
        </div>
        <div className="flex flex-col gap-4">
          {privacyItems.map(({ key, icon: Icon }) => (
            <div key={key} className={`bg-card flex gap-4 rounded-xl border p-4 ${liftCard}`}>
              <Icon className="text-primary mt-0.5 size-5 shrink-0" />
              <div>
                <div className="font-semibold">{t(`privacy.items.${key}.title`)}</div>
                <p className="text-muted-foreground text-sm">{t(`privacy.items.${key}.body`)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Verse() {
  const { t } = useTranslation("landing")
  return (
    <section className="mx-auto max-w-prose px-4 pb-12 text-center md:pb-16">
      <LoneSheep className="mx-auto mb-4 w-16" />
      <blockquote className="font-serif text-xl italic md:text-2xl">
        “{t("verse.quote")}”
      </blockquote>
      <p className="text-muted-foreground mt-3 text-sm not-italic">{t("verse.reference")}</p>
    </section>
  )
}

function FinalCta() {
  const { t } = useTranslation("landing")
  return (
    <section className="mx-auto max-w-6xl px-4 pb-16 md:px-6 md:pb-24">
      <div className="from-primary relative flex flex-col items-center gap-6 overflow-hidden rounded-3xl bg-linear-to-br to-[oklch(0.45_0.13_170)] px-6 pt-12 pb-28 text-center text-white shadow-xl md:pt-16 md:pb-36">
        <h2 className="text-3xl font-bold md:text-4xl">{t("finalCta.title")}</h2>
        <p className="max-w-prose text-lg text-white/90">{t("finalCta.body")}</p>
        <p className="font-serif text-lg italic">{t("finalCta.madeBy")}</p>
        <Button asChild size="lg" variant="secondary" className="group relative z-10 h-11">
          <a href="mailto:kharisisriyant@gmail.com">
            {t("hero.cta")}{" "}
            <ArrowRight className="transition-transform group-hover:translate-x-1" />
          </a>
        </Button>
        <HillsFooter className="absolute inset-x-0 bottom-0 h-24 md:h-32" />
      </div>
    </section>
  )
}

function Footer() {
  const { t } = useTranslation("landing")
  return (
    <footer className="border-t">
      <div className="text-muted-foreground mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm md:flex-row md:px-6">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="" className="size-4 object-contain" />
          <span>© {new Date().getFullYear()} gembala</span>
        </div>
        <div className="flex flex-wrap justify-center gap-6">
          <LegalLinks />
          <Link to="/login" className="hover:text-foreground transition-colors">
            {t("footer.signIn")}
          </Link>
          <a
            href="mailto:kharisisriyant@gmail.com"
            className="hover:text-foreground transition-colors"
          >
            {t("footer.signUp")}
          </a>
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
        <PainPoints />
        <Features />
        <Personas />
        <HowItWorks />
        <TelegramSection />
        <Privacy />
        <Verse />
        <FinalCta />
      </main>
      <Footer />
    </div>
  )
}
