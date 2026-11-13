import { z } from "zod"
import type { NotificationLocale, NotificationType, RenderedContent } from "./notifications.catalog"

const DAY = 86_400_000

const pick = (locale: NotificationLocale, copy: { en: RenderedContent; id: RenderedContent }) => copy[locale]
const typeWord = (locale: NotificationLocale, type: "prayer" | "care") =>
  locale === "id" ? (type === "prayer" ? "doa" : "pelayanan") : type
const memberVisible: NonNullable<NotificationType["canAccess"]> = ({ userId, orgId, payload }, access) =>
  access.memberVisible(userId, orgId, payload.memberId)

const careBase = { memberId: z.string().uuid(), memberName: z.string(), type: z.enum(["prayer", "care"]) }

const careAssigned = {
  key: "care_request.assigned",
  category: "activity",
  priority: "normal",
  defaultChannels: ["telegram"],
  ttlMs: 14 * DAY,
  payload: z.object({ ...careBase, assignedBy: z.string(), dueAt: z.string().nullable() }),
  canAccess: memberVisible,
  render: (l, p) =>
    pick(l, {
      en: { title: `New ${typeWord(l, p.type)} request: ${p.memberName}`, body: `${p.assignedBy} assigned you a ${typeWord(l, p.type)} request about ${p.memberName}.${p.dueAt ? ` Follow up by ${p.dueAt}.` : ""}`, link: "/care-requests" },
      id: { title: `Permintaan ${typeWord(l, p.type)} baru: ${p.memberName}`, body: `${p.assignedBy} menugaskan Anda permintaan ${typeWord(l, p.type)} untuk ${p.memberName}.${p.dueAt ? ` Tindak lanjut sebelum ${p.dueAt}.` : ""}`, link: "/care-requests" },
    }),
} satisfies NotificationType<{ memberId: string; memberName: string; type: "prayer" | "care"; assignedBy: string; dueAt: string | null }>

const careReopened = {
  key: "care_request.reopened",
  category: "activity",
  priority: "normal",
  defaultChannels: [],
  ttlMs: 14 * DAY,
  payload: z.object({ ...careBase, reopenedBy: z.string() }),
  canAccess: memberVisible,
  render: (l, p) =>
    pick(l, {
      en: { title: `Request reopened: ${p.memberName}`, body: `${p.reopenedBy} reopened the ${typeWord(l, p.type)} request about ${p.memberName}, which you own.`, link: "/care-requests" },
      id: { title: `Permintaan dibuka kembali: ${p.memberName}`, body: `${p.reopenedBy} membuka kembali permintaan ${typeWord(l, p.type)} untuk ${p.memberName} yang Anda tangani.`, link: "/care-requests" },
    }),
} satisfies NotificationType<{ memberId: string; memberName: string; type: "prayer" | "care"; reopenedBy: string }>

const careDueSoon = {
  key: "care_request.due_soon",
  category: "reminder",
  priority: "normal",
  defaultChannels: ["email", "telegram"],
  ttlMs: 2 * DAY,
  payload: z.object({ ...careBase, dueAt: z.string(), daysLeft: z.number().int() }),
  canAccess: memberVisible,
  render: (l, p) =>
    pick(l, {
      en: { title: `Follow-up due ${p.daysLeft === 0 ? "today" : "tomorrow"}: ${p.memberName}`, body: `Your ${typeWord(l, p.type)} request about ${p.memberName} is due ${p.dueAt}.`, link: "/care-requests" },
      id: { title: `Tindak lanjut jatuh tempo ${p.daysLeft === 0 ? "hari ini" : "besok"}: ${p.memberName}`, body: `Permintaan ${typeWord(l, p.type)} untuk ${p.memberName} jatuh tempo ${p.dueAt}.`, link: "/care-requests" },
    }),
} satisfies NotificationType<{ memberId: string; memberName: string; type: "prayer" | "care"; dueAt: string; daysLeft: number }>

const careOverdue = {
  key: "care_request.overdue",
  category: "reminder",
  priority: "normal",
  defaultChannels: ["email", "telegram"],
  ttlMs: 2 * DAY,
  payload: z.object({ ...careBase, dueAt: z.string(), overdueDays: z.number().int() }),
  canAccess: memberVisible,
  render: (l, p) =>
    pick(l, {
      en: { title: `Overdue ${p.overdueDays} day${p.overdueDays === 1 ? "" : "s"}: ${p.memberName}`, body: `Your ${typeWord(l, p.type)} request about ${p.memberName} was due ${p.dueAt} and is still open.`, link: "/care-requests" },
      id: { title: `Terlambat ${p.overdueDays} hari: ${p.memberName}`, body: `Permintaan ${typeWord(l, p.type)} untuk ${p.memberName} jatuh tempo ${p.dueAt} dan masih terbuka.`, link: "/care-requests" },
    }),
} satisfies NotificationType<{ memberId: string; memberName: string; type: "prayer" | "care"; dueAt: string; overdueDays: number }>

const absenceStreak = {
  key: "attention.absence_streak",
  category: "reminder",
  priority: "low",
  defaultChannels: ["telegram"],
  ttlMs: 7 * DAY,
  payload: z.object({ memberId: z.string().uuid(), memberName: z.string(), groupId: z.string().uuid(), groupName: z.string(), missed: z.number().int() }),
  canAccess: memberVisible,
  render: (l, p) =>
    pick(l, {
      en: { title: `${p.memberName} missed ${p.missed} sessions in a row`, body: `${p.memberName} hasn't attended the last ${p.missed} sessions of ${p.groupName}. Consider reaching out.`, link: `/groups/${p.groupId}` },
      id: { title: `${p.memberName} tidak hadir ${p.missed} pertemuan berturut-turut`, body: `${p.memberName} tidak hadir pada ${p.missed} pertemuan terakhir ${p.groupName}. Pertimbangkan untuk menghubungi.`, link: `/groups/${p.groupId}` },
    }),
} satisfies NotificationType<{ memberId: string; memberName: string; groupId: string; groupName: string; missed: number }>

const stageReminder = {
  key: "journey.stage_reminder",
  category: "reminder",
  priority: "normal",
  defaultChannels: ["email", "telegram"],
  ttlMs: 7 * DAY,
  payload: z.object({ memberId: z.string().uuid(), memberName: z.string(), daysSince: z.number().int().nullable() }),
  canAccess: memberVisible,
  render: (l, p) =>
    pick(l, {
      en: { title: `Follow up with ${p.memberName}`, body: `${p.memberName} is a newcomer waiting for a follow-up${p.daysSince !== null ? ` (${p.daysSince} days since their first visit)` : ""}.`, link: "/journey" },
      id: { title: `Tindak lanjuti ${p.memberName}`, body: `${p.memberName} adalah pendatang baru yang menunggu tindak lanjut${p.daysSince !== null ? ` (${p.daysSince} hari sejak kunjungan pertama)` : ""}.`, link: "/journey" },
    }),
} satisfies NotificationType<{ memberId: string; memberName: string; daysSince: number | null }>

const inviteAccepted = {
  key: "invite.accepted",
  category: "activity",
  priority: "normal",
  defaultChannels: [],
  ttlMs: 14 * DAY,
  payload: z.object({ inviteeName: z.string() }),
  render: (l, p) =>
    pick(l, {
      en: { title: `${p.inviteeName} joined your team`, body: `${p.inviteeName} accepted your invitation and can now sign in.`, link: "/team" },
      id: { title: `${p.inviteeName} bergabung dengan tim Anda`, body: `${p.inviteeName} menerima undangan Anda dan sekarang dapat masuk.`, link: "/team" },
    }),
} satisfies NotificationType<{ inviteeName: string }>

const passwordChanged = {
  key: "security.password_changed",
  category: "security",
  priority: "high",
  defaultChannels: ["email"],
  ttlMs: 7 * DAY,
  payload: z.object({}),
  render: (l) =>
    pick(l, {
      en: { title: "Your password was changed", body: "Your Gembala password was just changed and all sessions were signed out. If this wasn't you, reset your password now.", link: "/profile?tab=security" },
      id: { title: "Kata sandi Anda diubah", body: "Kata sandi Gembala Anda baru saja diubah dan semua sesi dikeluarkan. Jika ini bukan Anda, segera atur ulang kata sandi.", link: "/profile?tab=security" },
    }),
} satisfies NotificationType<Record<string, never>>

const refreshReuse = {
  key: "security.refresh_reuse",
  category: "security",
  priority: "high",
  defaultChannels: ["email"],
  ttlMs: 7 * DAY,
  payload: z.object({}),
  render: (l) =>
    pick(l, {
      en: { title: "Suspicious sign-in activity", body: "We detected a sign-in token being reused, so we signed that session out. If this wasn't you, change your password.", link: "/profile?tab=security" },
      id: { title: "Aktivitas masuk yang mencurigakan", body: "Kami mendeteksi token masuk digunakan ulang, sehingga sesi itu dikeluarkan. Jika ini bukan Anda, ubah kata sandi Anda.", link: "/profile?tab=security" },
    }),
} satisfies NotificationType<Record<string, never>>

const weeklyDigest = {
  key: "digest.weekly",
  category: "reminder",
  priority: "low",
  defaultChannels: ["email", "telegram"],
  ttlMs: 6 * DAY,
  payload: z.object({ subject: z.string(), text: z.string() }),
  render: (_l, p) => ({ title: p.subject, body: p.text, link: "/dashboard" }),
} satisfies NotificationType<{ subject: string; text: string }>

export const notificationTypes: NotificationType[] = [
  careAssigned,
  careReopened,
  careDueSoon,
  careOverdue,
  absenceStreak,
  stageReminder,
  inviteAccepted,
  passwordChanged,
  refreshReuse,
  weeklyDigest,
] as NotificationType[]
