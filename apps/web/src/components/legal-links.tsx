import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

export function LegalLinks() {
  const { t } = useTranslation("legal")

  return (
    <nav aria-label={t("navigation")} className="text-muted-foreground flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
      <Link to="/privacy-policy" className="hover:text-foreground hover:underline">{t("privacy.title")}</Link>
      <Link to="/terms-and-conditions" className="hover:text-foreground hover:underline">{t("terms.title")}</Link>
    </nav>
  )
}
