import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
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
import { LanguageToggle } from "@/components/language-toggle"
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
                <Link to="/register">{t("nav.signUpFree")}</Link>
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

function HeroPreview() {
  const { t } = useTranslation("landing")
  return (
    <Card className="gap-4 py-4" aria-hidden>
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
  )
}

function Hero() {
  const { t } = useTranslation("landing")
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 md:grid-cols-2 md:px-6 md:py-24">
      <div>
        <Badge variant="outline" className="mb-4">
          <Sprout /> {t("hero.badge")}
        </Badge>
        <h1 className="text-4xl font-bold text-balance md:text-5xl">{t("hero.title")}</h1>
        <p className="text-muted-foreground mt-4 max-w-prose text-lg">{t("hero.body")}</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg" className="h-11">
            <Link to="/register">
              {t("hero.cta")} <ArrowRight />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-11">
            <a href="#fitur">{t("hero.ctaSecondary")}</a>
          </Button>
        </div>
        <p className="text-muted-foreground mt-4 text-sm">{t("hero.note")}</p>
      </div>
      <HeroPreview />
    </section>
  )
}

const features = [
  { key: "members", icon: Users },
  { key: "attendance", icon: CalendarCheck },
  { key: "followup", icon: BellRing },
  { key: "tags", icon: Tags },
  { key: "invite", icon: UserPlus },
  { key: "notes", icon: HeartHandshake },
] as const

function Features() {
  const { t } = useTranslation("landing")
  return (
    <section id="fitur" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 md:px-6 md:py-24">
      <div className="max-w-2xl">
        <h2 className="text-2xl font-semibold md:text-3xl">{t("features.title")}</h2>
        <p className="text-muted-foreground mt-3 text-lg">{t("features.subtitle")}</p>
      </div>
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {features.map(({ key, icon: Icon }) => (
          <Card key={key}>
            <CardHeader>
              <div className="bg-primary/10 text-primary mb-2 flex size-10 items-center justify-center rounded-md">
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
  const { t } = useTranslation("landing")
  const listItems = [
    t("telegramSection.list.log"),
    t("telegramSection.list.ask"),
    t("telegramSection.list.notes"),
  ]
  return (
    <section id="telegram" className="bg-card scroll-mt-20 border-y">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 md:grid-cols-2 md:px-6 md:py-24">
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
        <Card className="bg-background gap-3 p-4" aria-label={t("telegramSection.chat.ariaLabel")}>
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
        </Card>
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
          <div className="bg-primary/10 text-primary mb-4 flex size-10 items-center justify-center rounded-md">
            <ShieldCheck className="size-5" />
          </div>
          <h2 className="text-2xl font-semibold md:text-3xl">{t("privacy.title")}</h2>
          <p className="text-muted-foreground mt-3 text-lg">{t("privacy.body")}</p>
        </div>
        <div className="flex flex-col gap-4">
          {privacyItems.map(({ key, icon: Icon }) => (
            <div key={key} className="bg-muted flex gap-4 rounded-lg p-4">
              <Icon className="text-muted-foreground mt-0.5 size-5 shrink-0" />
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
    <section className="mx-auto max-w-prose px-4 py-12 text-center md:py-16">
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
      <Card className="items-center px-6 py-12 text-center md:py-16">
        <h2 className="text-2xl font-semibold md:text-3xl">{t("finalCta.title")}</h2>
        <p className="text-muted-foreground max-w-prose text-lg">{t("finalCta.body")}</p>
        <Button asChild size="lg" className="h-11">
          <Link to="/register">
            {t("hero.cta")} <ArrowRight />
          </Link>
        </Button>
      </Card>
    </section>
  )
}

function Footer() {
  const { t } = useTranslation("landing")
  return (
    <footer className="border-t">
      <div className="text-muted-foreground mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm md:flex-row md:px-6">
        <div className="flex items-center gap-2">
          <Leaf className="text-primary size-4" />
          <span>© {new Date().getFullYear()} Gembala</span>
        </div>
        <div className="flex gap-6">
          <Link to="/login" className="hover:text-foreground transition-colors">
            {t("footer.signIn")}
          </Link>
          <Link to="/register" className="hover:text-foreground transition-colors">
            {t("footer.signUp")}
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
