import { Injectable } from "@nestjs/common"
import { and, asc, eq, inArray, isNotNull, isNull, lt, notInArray, or, sql } from "drizzle-orm"
import type { DeliveryStatus, NotificationChannel, SkipReason } from "@gembala/shared"
import { InjectDb, type Db, type Tx } from "../db/drizzle.module"
import {
  notificationDeliveries,
  notificationEvents,
  notificationKillSwitches,
  notifications,
  orgMemberships,
  userNotificationPreferences,
  userSettings,
  users,
} from "../db/schema"

type Conn = Db | Tx

export type EventRow = typeof notificationEvents.$inferSelect
export type NotificationRow = typeof notifications.$inferSelect
export type DeliveryRow = typeof notificationDeliveries.$inferSelect

const TERMINAL: DeliveryStatus[] = ["sent", "delivered", "failed", "skipped"]

@Injectable()
export class NotificationsRepository {
  constructor(@InjectDb() private readonly db: Db) {}

  // Null when the idempotency key already exists (RT-3).
  async insertEvent(values: typeof notificationEvents.$inferInsert, tx: Conn = this.db) {
    const [row] = await tx
      .insert(notificationEvents)
      .values(values)
      .onConflictDoNothing({ target: notificationEvents.idempotencyKey })
      .returning()
    return row ?? null
  }

  // Outbox claim: rows stay locked until the surrounding transaction ends.
  claimUnprocessedEvents(limit: number, tx: Conn) {
    return tx
      .select()
      .from(notificationEvents)
      .where(isNull(notificationEvents.processedAt))
      .orderBy(asc(notificationEvents.createdAt))
      .limit(limit)
      .for("update", { skipLocked: true })
  }

  async markEventProcessed(id: string, tx: Conn = this.db) {
    await tx.update(notificationEvents).set({ processedAt: new Date() }).where(eq(notificationEvents.id, id))
  }

  // Active users who still belong to the org, with their locale (default Indonesian).
  async routingUsers(userIds: string[], orgId: string, tx: Conn = this.db) {
    if (userIds.length === 0) return []
    const rows = await tx
      .select({ userId: users.id, locale: userSettings.locale })
      .from(users)
      .innerJoin(orgMemberships, and(eq(orgMemberships.userId, users.id), eq(orgMemberships.orgId, orgId)))
      .leftJoin(userSettings, eq(userSettings.userId, users.id))
      .where(and(inArray(users.id, userIds), eq(users.authStatus, "active")))
    return rows.map((r) => ({ userId: r.userId, locale: r.locale === "en" ? ("en" as const) : ("id" as const) }))
  }

  preferenceOverrides(userIds: string[], tx: Conn = this.db) {
    if (userIds.length === 0) return Promise.resolve([])
    return tx
      .select({
        userId: userNotificationPreferences.userId,
        category: userNotificationPreferences.category,
        channel: userNotificationPreferences.channel,
        enabled: userNotificationPreferences.enabled,
      })
      .from(userNotificationPreferences)
      .where(inArray(userNotificationPreferences.userId, userIds))
  }

  killSwitches(tx: Conn = this.db) {
    return tx.select({ typeKey: notificationKillSwitches.typeKey, channel: notificationKillSwitches.channel }).from(notificationKillSwitches)
  }

  async insertNotification(values: typeof notifications.$inferInsert, tx: Conn = this.db) {
    const [row] = await tx
      .insert(notifications)
      .values(values)
      .onConflictDoNothing({ target: [notifications.eventId, notifications.userId] })
      .returning()
    return row ?? null
  }

  async insertDeliveries(values: (typeof notificationDeliveries.$inferInsert)[], tx: Conn = this.db) {
    if (values.length === 0) return
    await tx
      .insert(notificationDeliveries)
      .values(values)
      .onConflictDoNothing({ target: [notificationDeliveries.notificationId, notificationDeliveries.channel] })
  }

  // Pending deliveries to hand to the queue; locked for the caller's transaction.
  claimPendingDeliveries(limit: number, tx: Conn) {
    return tx
      .select({
        id: notificationDeliveries.id,
        channel: notificationDeliveries.channel,
        sendAt: notificationDeliveries.sendAt,
        priority: notifications.priority,
      })
      .from(notificationDeliveries)
      .innerJoin(notifications, eq(notifications.id, notificationDeliveries.notificationId))
      .where(eq(notificationDeliveries.status, "pending"))
      .orderBy(asc(notificationDeliveries.createdAt))
      .limit(limit)
      .for("update", { of: notificationDeliveries, skipLocked: true })
  }

  async markQueued(ids: string[], tx: Conn = this.db) {
    if (ids.length === 0) return
    await tx
      .update(notificationDeliveries)
      .set({ status: "queued", updatedAt: new Date() })
      .where(and(inArray(notificationDeliveries.id, ids), eq(notificationDeliveries.status, "pending")))
  }

  // Deliveries stuck in pending/queued past `before` (lost queue job or crashed relay).
  // Scheduled ones are only stuck once their send time is also past.
  async staleDeliveries(before: Date, limit: number, tx: Conn = this.db) {
    return tx
      .select({
        id: notificationDeliveries.id,
        channel: notificationDeliveries.channel,
        sendAt: notificationDeliveries.sendAt,
        priority: notifications.priority,
      })
      .from(notificationDeliveries)
      .innerJoin(notifications, eq(notifications.id, notificationDeliveries.notificationId))
      .where(
        and(
          inArray(notificationDeliveries.status, ["pending", "queued"]),
          lt(notificationDeliveries.updatedAt, before),
          or(isNull(notificationDeliveries.sendAt), lt(notificationDeliveries.sendAt, before)),
        ),
      )
      .orderBy(asc(notificationDeliveries.updatedAt))
      .limit(limit)
  }

  async touchDeliveries(ids: string[], tx: Conn = this.db) {
    if (ids.length === 0) return
    await tx
      .update(notificationDeliveries)
      .set({ status: "queued", updatedAt: new Date() })
      .where(and(inArray(notificationDeliveries.id, ids), inArray(notificationDeliveries.status, ["pending", "queued"])))
  }

  async deliveryContext(id: string, tx: Conn = this.db) {
    const [row] = await tx
      .select({ delivery: notificationDeliveries, notification: notifications })
      .from(notificationDeliveries)
      .innerJoin(notifications, eq(notifications.id, notificationDeliveries.notificationId))
      .where(eq(notificationDeliveries.id, id))
    return row ?? null
  }

  async recordAttempt(id: string, tx: Conn = this.db) {
    await tx
      .update(notificationDeliveries)
      .set({ attempts: sql`${notificationDeliveries.attempts} + 1`, updatedAt: new Date() })
      .where(eq(notificationDeliveries.id, id))
  }

  // Only open deliveries can finish, so a duplicate job can never overwrite a result.
  async finishDelivery(
    id: string,
    patch: { status: "sent" | "failed" | "skipped"; providerMessageId?: string; errorCode?: string; skipReason?: SkipReason },
    tx: Conn = this.db,
  ) {
    const rows = await tx
      .update(notificationDeliveries)
      .set({
        status: patch.status,
        providerMessageId: patch.providerMessageId ?? null,
        errorCode: patch.errorCode ?? null,
        skipReason: patch.skipReason ?? null,
        updatedAt: new Date(),
      })
      .where(and(eq(notificationDeliveries.id, id), notInArray(notificationDeliveries.status, TERMINAL)))
      .returning({ id: notificationDeliveries.id })
    return rows.length > 0
  }

  // Failed deliveries back to pending so the dispatcher enqueues them again (replay).
  async resetFailed(channel?: NotificationChannel, tx: Conn = this.db) {
    const rows = await tx
      .update(notificationDeliveries)
      .set({ status: "pending", errorCode: null, attempts: 0, updatedAt: new Date() })
      .where(and(eq(notificationDeliveries.status, "failed"), channel ? eq(notificationDeliveries.channel, channel) : undefined))
      .returning({ id: notificationDeliveries.id, channel: notificationDeliveries.channel })
    return rows
  }

  // Retention (D7): inbox/events 90 days, payloads and delivery log 30 days.
  async purge(now: Date) {
    const days = (n: number) => new Date(now.getTime() - n * 86_400_000)
    const expired = await this.db
      .delete(notificationEvents)
      .where(lt(notificationEvents.createdAt, days(90)))
      .returning({ id: notificationEvents.id })
    const scrubbed = await this.db
      .update(notificationEvents)
      .set({ payload: {}, recipientUserIds: [] })
      .where(and(isNotNull(notificationEvents.processedAt), lt(notificationEvents.createdAt, days(30)), sql`${notificationEvents.payload} <> '{}'::jsonb`))
      .returning({ id: notificationEvents.id })
    const deliveries = await this.db
      .delete(notificationDeliveries)
      .where(and(inArray(notificationDeliveries.status, TERMINAL), lt(notificationDeliveries.createdAt, days(30))))
      .returning({ id: notificationDeliveries.id })
    return { events: expired.length, scrubbed: scrubbed.length, deliveries: deliveries.length }
  }
}
