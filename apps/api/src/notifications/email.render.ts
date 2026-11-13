import type { NotificationLocale } from "./notifications.catalog"

const COPY = {
  en: {
    open: "Open",
    why: "You received this because of your notification settings in Gembala.",
    preferences: "Manage notification preferences",
    unsubscribe: "Unsubscribe from these emails",
  },
  id: {
    open: "Buka",
    why: "Anda menerima email ini karena pengaturan notifikasi Anda di Gembala.",
    preferences: "Kelola preferensi notifikasi",
    unsubscribe: "Berhenti berlangganan email ini",
  },
} as const

export const escapeHtml = (value: string) =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;")

export type EmailInput = {
  title: string
  body: string
  link: string | null // absolute URL on our web origin
  locale: NotificationLocale
  preferencesUrl: string
  unsubscribeUrl: string | null // null for categories users cannot opt out of
}

// HTML + plain text from the content stored on the notification, so a retry
// produces the same message (TP-3). Light/dark friendly: no fixed backgrounds.
export function renderEmail(input: EmailInput): { subject: string; html: string; text: string } {
  const c = COPY[input.locale]
  const action = input.link
    ? `<p style="margin:24px 0"><a href="${escapeHtml(input.link)}" style="display:inline-block;padding:10px 18px;border-radius:6px;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:600">${c.open}</a></p>`
    : ""
  const footerLinks = [
    `<a href="${escapeHtml(input.preferencesUrl)}">${c.preferences}</a>`,
    input.unsubscribeUrl ? `<a href="${escapeHtml(input.unsubscribeUrl)}">${c.unsubscribe}</a>` : null,
  ].filter(Boolean).join(" · ")
  const html =
    `<!doctype html><html lang="${input.locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"></head>` +
    `<body style="margin:0;padding:24px;font-family:-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.5">` +
    `<div style="max-width:560px;margin:0 auto"><h1 style="font-size:20px;margin:0 0 12px">${escapeHtml(input.title)}</h1>` +
    `<p style="margin:0">${escapeHtml(input.body).replaceAll("\n", "<br>")}</p>${action}` +
    `<hr style="border:none;border-top:1px solid #8884;margin:24px 0"><p style="font-size:12px;opacity:.7;margin:0 0 8px">${c.why}</p>` +
    `<p style="font-size:12px;margin:0">${footerLinks}</p></div></body></html>`
  const text = [
    input.title,
    "",
    input.body,
    input.link ? `\n${c.open}: ${input.link}` : "",
    "",
    "--",
    c.why,
    `${c.preferences}: ${input.preferencesUrl}`,
    input.unsubscribeUrl ? `${c.unsubscribe}: ${input.unsubscribeUrl}` : "",
  ].filter((line, i, all) => line !== "" || all[i - 1] !== "").join("\n")
  return { subject: input.title, html, text }
}
