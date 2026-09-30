import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { LanguageToggle } from "@/components/language-toggle"
import { LegalLinks } from "@/components/legal-links"

type LegalSection = { title: string; body: string }

export function LegalPage({ document }: { document: "privacy" | "terms" }) {
  const { t, i18n } = useTranslation("legal")
  const sections = t(`${document}.sections`, { returnObjects: true }) as LegalSection[]

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [document])

  return (
    <div className="min-h-dvh" lang={i18n.resolvedLanguage}>
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link to="/" className="text-sm hover:underline">{t("home")}</Link>
          <LanguageToggle />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">{t(`${document}.title`)}</h1>
        <p className="text-muted-foreground mt-3 text-sm">{t("updated")}</p>
        <p className="bg-muted text-muted-foreground mt-6 rounded-lg border p-4 text-sm leading-relaxed">{t("draft")}</p>
        <p className="mt-8 leading-relaxed">{t(`${document}.intro`)}</p>
        <div className="mt-10 space-y-8">
          {sections.map((section, index) => (
            <section key={`${document}-${index}`} aria-labelledby={`section-${index}`}>
              <h2 id={`section-${index}`} className="text-xl font-semibold">{index + 1}. {section.title}</h2>
              <p className="text-muted-foreground mt-3 leading-relaxed">{section.body}</p>
            </section>
          ))}
          <section aria-labelledby="contact">
            <h2 id="contact" className="text-xl font-semibold">{t("contact.title")}</h2>
            <p className="text-muted-foreground mt-3 leading-relaxed">{t("contact.body")}</p>
            <a href="mailto:kharisisriyant@gmail.com" className="mt-2 inline-block break-all underline underline-offset-4">kharisisriyant@gmail.com</a>
          </section>
        </div>
      </main>
      <footer className="border-t px-4 py-8"><LegalLinks /></footer>
    </div>
  )
}
