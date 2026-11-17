import { addDays, type DigestLocale } from "@gembala/shared"
import type { AttentionItems } from "../attention/attention.service"
import type { CareOpenSummary } from "../care-requests/care-requests.service"

// Pure: structured digest + locale -> message text. No I/O, no clock.

export type DigestData = {
  kind: "personal" | "admin"
  userName: string
  weekStart: string // Monday, YYYY-MM-DD
  items: AttentionItems
  summary?: CareOpenSummary // admin only
}

export type RenderedDigest = { subject: string; text: string; html: string }

const MAX_LINES = 5
// Telegram rejects messages over 4096 characters.
const MAX_TEXT = 4000

type Block = { title: string; lines: string[]; more: number }

const t = {
  en: {
    subject: (range: string) => `Your weekly gembala digest · ${range}`,
    greet: (name: string, range: string) => `Good morning ${name}. Week of ${range}`,
    need: (n: number) => `${n} need you`,
    nothingUrgent: "nothing urgent",
    teamSummary: "team summary",
    care: "CARE",
    absent: "ABSENT",
    newcomers: "NEWCOMERS",
    fyi: "FYI",
    yourCare: "YOUR CARE",
    teamCare: "TEAM CARE",
    teamOverdue: "LONGEST OVERDUE",
    byOwner: "BY OWNER",
    org: "ORGANIZATION",
    more: (n: number) => `+${n} more`,
    careType: (type: "prayer" | "care") => (type === "prayer" ? "prayer request" : "care request"),
    days: (n: number) => `${n} ${n === 1 ? "day" : "days"}`,
    open: (d: string) => `open ${d}`,
    overdue: (d: string) => `overdue ${d}`,
    alsoAbsent: (n: number) => `also absent ${n}`,
    missed: (n: number) => `missed ${n}`,
    lastSeen: (d: string) => `last seen ${d}`,
    neverSeen: "never attended",
    sinceFirst: (d: string) => `${d} since first visit`,
    birthdays: "Birthdays",
    ready: "Ready for next step",
    openApp: "Open gembala",
    mute: "Mute this digest",
    ownerOpen: (name: string, open: number, overdue: number) => `${name}: ${open} open, ${overdue} overdue`,
    unassigned: (n: number) => `${n} unassigned`,
    ownerCannotSee: (n: number) => `${n} whose owner can no longer see the member`,
    unassignedOwner: "unassigned",
    orgCounts: (absent: number, newcomers: number, birthdays: number) =>
      `${absent} absent, ${newcomers} newcomers to follow up, ${birthdays} birthdays this week`,
    locale: "en-GB",
  },
  id: {
    subject: (range: string) => `Rangkuman mingguan gembala · ${range}`,
    greet: (name: string, range: string) => `Selamat pagi ${name}. Minggu ${range}`,
    need: (n: number) => `${n} perlu perhatianmu`,
    nothingUrgent: "tidak ada yang mendesak",
    teamSummary: "ringkasan tim",
    care: "PELAYANAN",
    absent: "TIDAK HADIR",
    newcomers: "JEMAAT BARU",
    fyi: "INFO",
    yourCare: "PELAYANANMU",
    teamCare: "PELAYANAN TIM",
    teamOverdue: "PALING TERLAMBAT",
    byOwner: "PER PENANGGUNG JAWAB",
    org: "ORGANISASI",
    more: (n: number) => `+${n} lagi`,
    careType: (type: "prayer" | "care") => (type === "prayer" ? "permohonan doa" : "permohonan pelayanan"),
    days: (n: number) => `${n} hari`,
    open: (d: string) => `terbuka ${d}`,
    overdue: (d: string) => `terlambat ${d}`,
    alsoAbsent: (n: number) => `juga absen ${n}`,
    missed: (n: number) => `absen ${n}`,
    lastSeen: (d: string) => `terakhir hadir ${d}`,
    neverSeen: "belum pernah hadir",
    sinceFirst: (d: string) => `${d} sejak kunjungan pertama`,
    birthdays: "Ulang tahun",
    ready: "Siap ke langkah berikutnya",
    openApp: "Buka gembala",
    mute: "Matikan rangkuman ini",
    ownerOpen: (name: string, open: number, overdue: number) => `${name}: ${open} terbuka, ${overdue} terlambat`,
    unassigned: (n: number) => `${n} belum ada penanggung jawab`,
    ownerCannotSee: (n: number) => `${n} yang penanggung jawabnya tak lagi bisa melihat anggota`,
    unassignedOwner: "belum ditugaskan",
    orgCounts: (absent: number, newcomers: number, birthdays: number) =>
      `${absent} tidak hadir, ${newcomers} jemaat baru perlu ditindaklanjuti, ${birthdays} ulang tahun minggu ini`,
    locale: "id-ID",
  },
} satisfies Record<DigestLocale, unknown>

const block = (title: string, lines: string[]): Block => ({
  title: `${title} (${lines.length})`,
  lines: lines.slice(0, MAX_LINES),
  more: Math.max(0, lines.length - MAX_LINES),
})

const escapeHtml = (v: string) =>
  v.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;")

export function isEmptyDigest(d: DigestData): boolean {
  const i = d.items
  const personalEmpty = !i.care.length && !i.absent.length && !i.newcomers.length && !i.nextStep.length && !i.birthdays.length
  if (d.kind === "personal" || !d.summary) return personalEmpty
  const s = d.summary
  return personalEmpty && !s.byOwner.length && !s.unassigned && !s.ownerCannotSee && !s.longestOverdue.length
}

export function renderDigest(d: DigestData, locale: DigestLocale, webOrigin: string): RenderedDigest {
  const m = t[locale]
  const fmtDate = (iso: string, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(m.locale, { timeZone: "UTC", ...opts }).format(new Date(`${iso}T00:00:00Z`))
  const range = `${fmtDate(d.weekStart, { day: "numeric", month: "short" })}–${fmtDate(addDays(d.weekStart, 6), { day: "numeric", month: "short" })}`
  const i = d.items

  const careLines = i.care.map((c) => {
    const parts = [`${c.memberName} — ${m.careType(c.type)}`, m.open(m.days(c.daysOpen))]
    if (c.overdueDays > 0) parts.push(m.overdue(m.days(c.overdueDays)))
    if (c.alsoAbsentMissed) parts.push(m.alsoAbsent(c.alsoAbsentMissed))
    return parts.join(" · ")
  })
  const absentLines = i.absent.map((a) =>
    [a.name, a.groupName, m.missed(a.missed), a.lastSeen ? m.lastSeen(fmtDate(a.lastSeen, { day: "numeric", month: "short" })) : m.neverSeen].join(" · "),
  )
  const newcomerLines = i.newcomers.map((n) => (n.daysSince === null ? n.name : `${n.name} · ${m.sinceFirst(m.days(n.daysSince))}`))
  const fyi: string[] = []
  if (i.birthdays.length) {
    fyi.push(`${m.birthdays}: ${i.birthdays.map((b) => `${b.name} (${fmtDate(b.date, { weekday: "short" })})`).join(", ")}`)
  }
  if (i.nextStep.length) fyi.push(`${m.ready}: ${i.nextStep.map((s) => `${s.stage} ${s.count}`).join(", ")}`)

  const blocks: Block[] = []
  let headline: string
  if (d.kind === "admin" && d.summary) {
    const s = d.summary
    headline = `${m.greet(d.userName, range)}: ${m.teamSummary}`
    const total = s.byOwner.reduce((sum, o) => sum + o.open, 0) + s.unassigned
    const overdue = s.byOwner.reduce((sum, o) => sum + o.overdue, 0)
    const teamLines = [`${total} open, ${overdue} overdue`]
    if (s.unassigned) teamLines.push(m.unassigned(s.unassigned))
    if (s.ownerCannotSee) teamLines.push(m.ownerCannotSee(s.ownerCannotSee))
    blocks.push({ title: m.teamCare, lines: teamLines, more: 0 })
    if (s.byOwner.length) blocks.push(block(m.byOwner, s.byOwner.map((o) => m.ownerOpen(o.name, o.open, o.overdue))))
    if (s.longestOverdue.length) {
      blocks.push(block(m.teamOverdue, s.longestOverdue.map((o) =>
        [`${o.memberName} — ${m.careType(o.type)}`, o.ownerName ?? m.unassignedOwner, m.overdue(m.days(o.overdueDays))].join(" · "))))
    }
    if (careLines.length) blocks.push(block(m.yourCare, careLines))
    blocks.push({ title: m.org, lines: [m.orgCounts(i.absent.length, i.newcomers.length, i.birthdays.length)], more: 0 })
  } else {
    const need = careLines.length + absentLines.length + newcomerLines.length
    headline = `${m.greet(d.userName, range)}: ${need > 0 ? m.need(need) : m.nothingUrgent}`
    if (careLines.length) blocks.push(block(m.care, careLines))
    if (absentLines.length) blocks.push(block(m.absent, absentLines))
    if (newcomerLines.length) blocks.push(block(m.newcomers, newcomerLines))
    if (fyi.length) blocks.push({ title: m.fyi, lines: fyi, more: 0 })
  }

  const appUrl = `${webOrigin}/care-requests`
  const muteUrl = `${webOrigin}/profile`

  const textParts = [headline, ""]
  for (const b of blocks) {
    textParts.push(b.title, ...b.lines.map((l) => `• ${l}`))
    if (b.more) textParts.push(m.more(b.more))
    textParts.push("")
  }
  textParts.push(`${m.openApp}: ${appUrl}`, `${m.mute}: ${muteUrl}`)
  const text = textParts.join("\n").slice(0, MAX_TEXT)

  const html = [
    `<p>${escapeHtml(headline)}</p>`,
    ...blocks.map(
      (b) =>
        `<p><strong>${escapeHtml(b.title)}</strong></p><ul>${b.lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}${b.more ? `<li><em>${escapeHtml(m.more(b.more))}</em></li>` : ""}</ul>`,
    ),
    `<p><a href="${escapeHtml(appUrl)}">${m.openApp}</a> · <a href="${escapeHtml(muteUrl)}">${m.mute}</a></p>`,
  ].join("")

  return { subject: m.subject(range), text, html }
}
