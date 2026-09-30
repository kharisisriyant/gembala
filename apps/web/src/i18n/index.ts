import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import LanguageDetector from "i18next-browser-languagedetector"
import commonEn from "./locales/en/common.json"
import commonId from "./locales/id/common.json"
import landingEn from "./locales/en/landing.json"
import landingId from "./locales/id/landing.json"
import dashboardEn from "./locales/en/dashboard.json"
import dashboardId from "./locales/id/dashboard.json"
import membersEn from "./locales/en/members.json"
import membersId from "./locales/id/members.json"
import eventsEn from "./locales/en/events.json"
import eventsId from "./locales/id/events.json"
import schedulingEn from "./locales/en/scheduling.json"
import schedulingId from "./locales/id/scheduling.json"
import groupsEn from "./locales/en/groups.json"
import groupsId from "./locales/id/groups.json"
import roomsEn from "./locales/en/rooms.json"
import roomsId from "./locales/id/rooms.json"
import tagsEn from "./locales/en/tags.json"
import tagsId from "./locales/id/tags.json"
import teamEn from "./locales/en/team.json"
import teamId from "./locales/id/team.json"
import invitesEn from "./locales/en/invites.json"
import invitesId from "./locales/id/invites.json"
import rolesEn from "./locales/en/roles.json"
import rolesId from "./locales/id/roles.json"
import profileEn from "./locales/en/profile.json"
import profileId from "./locales/id/profile.json"
import careRequestsEn from "./locales/en/care-requests.json"
import careRequestsId from "./locales/id/care-requests.json"
import journeyEn from "./locales/en/journey.json"
import journeyId from "./locales/id/journey.json"

import legalEn from "./locales/en/legal.json"
import legalId from "./locales/id/legal.json"

export const defaultNS = "common"

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: commonEn,
        legal: legalEn,
        landing: landingEn,
        dashboard: dashboardEn,
        members: membersEn,
        events: eventsEn,
        scheduling: schedulingEn,
        groups: groupsEn,
        rooms: roomsEn,
        tags: tagsEn,
        team: teamEn,
        invites: invitesEn,
        roles: rolesEn,
        profile: profileEn,
        "care-requests": careRequestsEn,
        journey: journeyEn,
      },
      id: {
        common: commonId,
        legal: legalId,
        landing: landingId,
        dashboard: dashboardId,
        members: membersId,
        events: eventsId,
        scheduling: schedulingId,
        groups: groupsId,
        rooms: roomsId,
        tags: tagsId,
        team: teamId,
        invites: invitesId,
        roles: rolesId,
        profile: profileId,
        "care-requests": careRequestsId,
        journey: journeyId,
      },
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
