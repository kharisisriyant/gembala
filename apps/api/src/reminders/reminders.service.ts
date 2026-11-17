import { Injectable, Logger } from "@nestjs/common"
import { addDays, daysBetweenDates, todayInZone } from "@gembala/shared"
import { AttentionService } from "../attention/attention.service"
import { AuthContextService } from "../authz/auth-context.service"
import { NotificationsService } from "../notifications/notifications.service"
import { RemindersRepository } from "./reminders.repository"

// Days overdue on which the owner is told again. Daily nagging is what the
// phase-2 fatigue controls are for; milestones keep phase 1 quiet.
export const OVERDUE_MILESTONES = [1, 7, 14, 30]

// Monday of the week containing `day` (YYYY-MM-DD).
function weekStartOf(day: string): string {
  const dow = new Date(`${day}T00:00:00Z`).getUTCDay()
  return addDays(day, -((dow + 6) % 7))
}

// Scheduled scans that turn state ("due tomorrow", "missed 3 sessions") into
// notifications. Every key carries what makes the event unique, so a rerun
// (cron retry, restart, second instance) produces nothing new (RT-3).
@Injectable()
export class RemindersService {
  private readonly log = new Logger("Reminders")

  constructor(
    private readonly repo: RemindersRepository,
    private readonly attention: AttentionService,
    private readonly authContext: AuthContextService,
    private readonly notifications: NotificationsService,
  ) {}

  async runDaily(now = new Date()): Promise<{ care: number; attention: number }> {
    const today = todayInZone(now)
    const result = { care: await this.runCare(today), attention: await this.runAttention(today) }
    this.log.log(`daily reminders ${today}: ${JSON.stringify(result)}`)
    return result
  }

  // Returns how many notifications were newly queued.
  async runCare(today: string): Promise<number> {
    let queued = 0
    for (const r of await this.repo.openOwnedWithDueDate()) {
      const base = { memberId: r.memberId, memberName: r.memberName, type: r.type, dueAt: r.dueAt }
      const daysLeft = daysBetweenDates(today, r.dueAt)
      let send: { type: string; payload: object; key: string } | null = null
      if (daysLeft === 0 || daysLeft === 1) {
        send = { type: "care_request.due_soon", payload: { ...base, daysLeft }, key: `care_due_soon:${r.id}:${r.dueAt}:${daysLeft}` }
      } else if (daysLeft < 0 && OVERDUE_MILESTONES.includes(-daysLeft)) {
        send = { type: "care_request.overdue", payload: { ...base, overdueDays: -daysLeft }, key: `care_overdue:${r.id}:${-daysLeft}` }
      }
      if (send && (await this.safely(() => this.notifications.notify({ type: send.type, orgId: r.orgId, recipients: [r.assignedToId], payload: send.payload, idempotencyKey: send.key })))) queued++
    }
    return queued
  }

  // Each user's own view (through their scope), so a leader only hears about
  // members they can see.
  async runAttention(today: string): Promise<number> {
    const week = weekStartOf(today)
    let queued = 0
    for (const { userId } of await this.repo.activeUserIds()) {
      try {
        const auth = await this.authContext.load(userId)
        if (!auth) continue
        const items = await this.attention.forUser(auth, today)
        for (const a of items.absent) {
          const ok = await this.notifications.notify({
            type: "attention.absence_streak",
            orgId: auth.orgId,
            recipients: [userId],
            payload: { memberId: a.memberId, memberName: a.name, groupId: a.groupId, groupName: a.groupName, missed: a.missed },
            idempotencyKey: `absence:${userId}:${a.memberId}:${a.missed}`,
          })
          if (ok) queued++
        }
        for (const n of items.newcomers) {
          const ok = await this.notifications.notify({
            type: "journey.stage_reminder",
            orgId: auth.orgId,
            recipients: [userId],
            payload: { memberId: n.memberId, memberName: n.name, daysSince: n.daysSince },
            idempotencyKey: `newcomer:${userId}:${n.memberId}:${week}`,
          })
          if (ok) queued++
        }
      } catch (err) {
        // One user's failure must not stop everyone else's reminders; log the id only.
        this.log.error(`attention reminders for user ${userId} failed: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
    return queued
  }

  private async safely(fn: () => Promise<boolean>): Promise<boolean> {
    try {
      return await fn()
    } catch (err) {
      this.log.error(`care reminder failed: ${err instanceof Error ? err.message : String(err)}`)
      return false
    }
  }
}
