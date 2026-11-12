import { addDays, daysBetweenDates } from "@gembala/shared"

// Pure rules for "who needs a leader's attention". Shared by the dashboard and
// the weekly digest so the two can never disagree about who is absent.

// A member is flagged after this many consecutive missed sessions (PRD FR-GRP-03).
export const ABSENCE_THRESHOLD = 2

export type AbsentItem = {
  memberId: string
  name: string
  groupId: string
  groupName: string
  // Current streak of consecutive missed sessions (most recent first).
  missed: number
  lastSeen: string | null
}

type GroupLike = { id: string; name: string; members: { id: string; name: string }[] }
type SessionLike = { date: string; presentIds: string[] }

export function absenceItems(
  groups: GroupLike[],
  sessionsByGroup: Map<string, SessionLike[]>,
  visibleMemberIds: Set<string>,
  opts: { threshold?: number; asOf?: string; dormantAfterDays?: number } = {},
): AbsentItem[] {
  const threshold = opts.threshold ?? ABSENCE_THRESHOLD
  const items: AbsentItem[] = []
  for (const group of groups) {
    const sessions = [...(sessionsByGroup.get(group.id) ?? [])].sort((a, b) => b.date.localeCompare(a.date))
    if (sessions.length < threshold) continue
    // A group that stopped meeting (or stopped recording) is not "everyone absent".
    if (opts.asOf && opts.dormantAfterDays !== undefined && daysBetweenDates(sessions[0].date, opts.asOf) > opts.dormantAfterDays) continue
    for (const member of group.members) {
      if (!visibleMemberIds.has(member.id)) continue
      let missed = 0
      while (missed < sessions.length && !sessions[missed].presentIds.includes(member.id)) missed++
      if (missed < threshold) continue
      const lastSeen = sessions.find((s) => s.presentIds.includes(member.id))?.date ?? null
      items.push({ memberId: member.id, name: member.name, groupId: group.id, groupName: group.name, missed, lastSeen })
    }
  }
  return items
}

// Whole days from `asOf` (YYYY-MM-DD) to the next occurrence of the birthday.
export function daysUntilBirthday(dateOfBirth: string, asOf: string): number {
  const [year] = asOf.split("-").map(Number)
  const [, month, day] = dateOfBirth.split("-").map(Number)
  // Feb 29 in a non-leap year rolls to Mar 1 via Date.UTC.
  const occurrence = (y: number) => new Date(Date.UTC(y, month - 1, day)).toISOString().slice(0, 10)
  const thisYear = occurrence(year)
  const next = thisYear >= asOf ? thisYear : occurrence(year + 1)
  return daysBetweenDates(asOf, next)
}

export type BirthdayItem = { memberId: string; name: string; dateOfBirth: string; daysUntil: number; date: string }

export function birthdaysWithin(
  members: { id: string; name: string; dateOfBirth: string | null }[],
  asOf: string,
  windowDays: number,
): BirthdayItem[] {
  return members
    .filter((m): m is typeof m & { dateOfBirth: string } => Boolean(m.dateOfBirth))
    .map((m) => ({ memberId: m.id, name: m.name, dateOfBirth: m.dateOfBirth, daysUntil: daysUntilBirthday(m.dateOfBirth, asOf) }))
    .filter((m) => m.daysUntil < windowDays)
    .map((m) => ({ ...m, date: addDays(asOf, m.daysUntil) }))
    .sort((a, b) => a.daysUntil - b.daysUntil || a.name.localeCompare(b.name))
}
