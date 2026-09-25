import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"

export function LanguageToggle() {
  const { i18n, t } = useTranslation()
  const current = i18n.language.split("-")[0] === "en" ? "en" : "id"
  const next = current === "id" ? "en" : "id"

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => i18n.changeLanguage(next)}
      aria-label={t("language.toggle")}
      title={t("language.toggle")}
    >
      <span className="text-xs font-semibold uppercase">{current}</span>
    </Button>
  )
}
