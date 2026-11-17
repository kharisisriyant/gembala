import { escapeHtml } from "../notifications/email.render"
import type { NotificationMail } from "../mail/mail.service"

export type RosterEmailInput = {
  locale: "en" | "id"
  churchName: string
  memberName: string
  roleName: string
  serviceName: string
  date: string // YYYY-MM-DD
  url: string
}

// Calendar date as words; parsed at UTC midnight so the day never shifts.
export function formatServiceDate(date: string, locale: "en" | "id"): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(locale === "id" ? "id-ID" : "en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })
}

// Sent to a church member (who has no account), so no preferences/unsubscribe
// footer: the mail goes out only when a leader presses "Notify".
export function renderRosterEmail(input: RosterEmailInput): NotificationMail {
  const day = formatServiceDate(input.date, input.locale)
  const copy =
    input.locale === "id"
      ? {
          subject: `${input.churchName}: jadwal pelayanan ${day}`,
          greeting: `Shalom ${input.memberName},`,
          body: `Anda dijadwalkan melayani sebagai ${input.roleName} di ${input.serviceName}, ${day}.`,
          ask: "Mohon konfirmasi apakah Anda bersedia melalui tautan berikut:",
          button: "Konfirmasi atau tolak",
          footer: `Email ini dikirim oleh ${input.churchName} melalui Gembala.`,
        }
      : {
          subject: `${input.churchName}: you're on the roster for ${day}`,
          greeting: `Hi ${input.memberName},`,
          body: `You're scheduled to serve as ${input.roleName} at ${input.serviceName} on ${day}.`,
          ask: "Please let us know whether you can make it:",
          button: "Confirm or decline",
          footer: `Sent by ${input.churchName} through Gembala.`,
        }

  const text = [copy.greeting, "", copy.body, copy.ask, input.url, "", copy.footer].join("\n")
  const html = [
    `<p>${escapeHtml(copy.greeting)}</p>`,
    `<p>${escapeHtml(copy.body)}</p>`,
    `<p>${escapeHtml(copy.ask)}</p>`,
    `<p><a href="${escapeHtml(input.url)}">${escapeHtml(copy.button)}</a></p>`,
    `<p style="font-size:12px;opacity:0.7">${escapeHtml(copy.footer)}</p>`,
  ].join("\n")
  return { subject: copy.subject, text, html }
}
