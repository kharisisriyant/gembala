import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import LanguageDetector from "i18next-browser-languagedetector"
import commonEn from "./locales/en/common.json"
import commonId from "./locales/id/common.json"
import landingEn from "./locales/en/landing.json"
import landingId from "./locales/id/landing.json"
import dashboardEn from "./locales/en/dashboard.json"
import dashboardId from "./locales/id/dashboard.json"

export const defaultNS = "common"

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { common: commonEn, landing: landingEn, dashboard: dashboardEn },
      id: { common: commonId, landing: landingId, dashboard: dashboardId },
    },
    fallbackLng: "id",
    supportedLngs: ["en", "id"],
    load: "languageOnly",
    defaultNS,
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "gembala-lang",
      caches: ["localStorage"],
    },
    interpolation: { escapeValue: false },
  })

export default i18n
