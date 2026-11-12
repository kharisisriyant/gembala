// Calendar-date helpers. Dates travel as `YYYY-MM-DD` strings; "today" is
// resolved in one fixed zone (v1 has no per-org timezone), so the API, the
// weekly digest and the web all agree on what day it is.

export const APP_TIME_ZONE = "Asia/Jakarta"

export function todayInZone(now: Date = new Date(), timeZone: string = APP_TIME_ZONE): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now)
}

const DAY_MS = 86_400_000
const toUtc = (iso: string) => Date.parse(`${iso}T00:00:00Z`)

export function addDays(iso: string, days: number): string {
  return new Date(toUtc(iso) + days * DAY_MS).toISOString().slice(0, 10)
}

// Whole days from `from` to `to` (negative when `to` is earlier).
export function daysBetweenDates(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS)
}
