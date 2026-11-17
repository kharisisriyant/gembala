import { Inject, Injectable, Logger } from "@nestjs/common"
import { randomUUID } from "node:crypto"
import { channelEnabled, type NotificationChannel, type SkipReason } from "@gembala/shared"
import { InjectDb, type Db, type Tx } from "../db/drizzle.module"
import { CHANNEL_ADAPTERS, type ChannelAdapter } from "./notifications.adapter"
import { NOTIFICATION_CATALOG, catalogByKey, type NotificationType } from "./notifications.catalog"
import { NotificationAccess } from "./notifications.access"
import { NotificationsRepository, type EventRow } from "./notifications.repository"

export type NotifyInput = {
  type: string
  orgId: string
  recipients: string[]
  payload: unknown
  idempotencyKey: string
  actorUserId?: string
  sendAt?: Date
}

const BATCH = 20

@Injectable()
export class NotificationsService {
  private readonly log = new Logger("Notifications")
  private readonly catalog: Map<string, NotificationType>
  private readonly adapters: Map<NotificationChannel, ChannelAdapter>

  constructor(
    private readonly repo: NotificationsRepository,
    @InjectDb() private readonly db: Db,
    @Inject(NOTIFICATION_CATALOG) types: NotificationType[],
    @Inject(CHANNEL_ADAPTERS) adapters: ChannelAdapter[],
    private readonly access: NotificationAccess,
  ) {
    this.catalog = catalogByKey(types)
    this.adapters = new Map(adapters.map((a) => [a.channel, a]))
  }

  // The one producer API (AR-1). Pass the producer's transaction so the event is
  // stored atomically with the change that caused it (AR-2). Returns false when
  // the idempotency key was already used.
  async notify(input: NotifyInput, tx: Db | Tx = this.db): Promise<boolean> {
    const type = this.catalog.get(input.type)
    if (!type) throw new Error(`Unknown notification type: ${input.type}`)
    const payload = type.payload.parse(input.payload) as Record<string, unknown>
    const recipients = [...new Set(input.recipients)]
    if (recipients.length === 0) return false
    const row = await this.repo.insertEvent(
      {
        orgId: input.orgId,
        typeKey: type.key,
        idempotencyKey: input.idempotencyKey,
        recipientUserIds: recipients,
        payload,
        actorUserId: input.actorUserId ?? null,
        sendAt: input.sendAt ?? null,
        correlationId: randomUUID(),
      },
      tx,
    )
    return row !== null
  }

  // For account-level events (security) that aren't about one org: files the
  // notification under the user's primary org. False when they belong to none.
  async notifyUser(input: Omit<NotifyInput, "orgId" | "recipients"> & { userId: string }, tx: Db | Tx = this.db): Promise<boolean> {
    const orgId = await this.repo.primaryOrgId(input.userId, tx)
    if (!orgId) return false
    return this.notify({ ...input, orgId, recipients: [input.userId] }, tx)
  }

  // Router: expands claimed events into notifications and deliveries. Each event
  // commits on its own so one bad event cannot block the rest. Returns events handled.
  async routePending(): Promise<number> {
    return this.db.transaction(async (tx) => {
      const events = await this.repo.claimUnprocessedEvents(BATCH, tx)
      for (const event of events) {
        try {
          await tx.transaction(async (savepoint) => this.route(event, savepoint))
        } catch (err) {
          // Poison event: record and move on rather than retry forever.
          this.log.error(`route failed event=${event.id} correlation=${event.correlationId}: ${(err as Error).message}`)
        }
        await this.repo.markEventProcessed(event.id, tx)
      }
      return events.length
    })
  }

  private async route(event: EventRow, tx: Tx) {
    const type = this.catalog.get(event.typeKey)
    if (!type) {
      this.log.error(`unknown type ${event.typeKey} event=${event.id} correlation=${event.correlationId}`)
      return
    }
    const wanted = event.recipientUserIds.filter((id) => id !== event.actorUserId) // RT-1
    const members = await this.repo.routingUsers(wanted, event.orgId, tx)
    const users = []
    for (const user of members) {
      if (await this.access.allowed(type.key, user.userId, event.orgId, event.payload)) users.push(user)
    }
    for (const id of wanted) {
      if (!users.some((u) => u.userId === id)) {
        this.log.log(`skip user=${id} reason=no_access event=${event.id} correlation=${event.correlationId}`)
      }
    }
    if (users.length === 0) return
    const overrides = await this.repo.preferenceOverrides(
      users.map((u) => u.userId),
      tx,
    )
    const switches = await this.repo.killSwitches(tx)
    const killed = (channel: NotificationChannel) =>
      switches.some((s) => (s.typeKey === null || s.typeKey === type.key) && (s.channel === null || s.channel === channel))
    const channels: NotificationChannel[] = ["inapp", ...type.defaultChannels.filter((c) => c !== "inapp")]

    for (const user of users) {
      const content = type.render(user.locale, event.payload)
      const notification = await this.repo.insertNotification(
        {
          eventId: event.id,
          orgId: event.orgId,
          userId: user.userId,
          typeKey: type.key,
          category: type.category,
          priority: type.priority,
          title: content.title,
          body: content.body,
          link: content.link,
          expiresAt: new Date((event.sendAt ?? event.createdAt).getTime() + type.ttlMs),
          correlationId: event.correlationId,
        },
        tx,
      )
      if (!notification) continue // already routed

      const userOverrides = overrides.filter((o) => o.userId === user.userId)
      const rows = []
      for (const channel of channels) {
        let skip: SkipReason | null = null
        if (killed(channel)) skip = "kill_switch"
        else if (!channelEnabled(type.category, channel, userOverrides)) skip = "preference"
        else {
          const adapter = this.adapters.get(channel)
          if (!adapter) continue // channel not built yet: nothing to record
          if (!(await adapter.available(user.userId))) skip = "not_connected"
        }
        if (skip) this.log.log(`skip user=${user.userId} channel=${channel} reason=${skip} notification=${notification.id} correlation=${event.correlationId}`)
        rows.push({
          notificationId: notification.id,
          channel,
          status: skip ? ("skipped" as const) : ("pending" as const),
          skipReason: skip,
          sendAt: event.sendAt,
          correlationId: event.correlationId,
        })
      }
      await this.repo.insertDeliveries(rows, tx)
    }
  }

  // Developer preview of a template (TP-8): validates the payload like notify() and renders it.
  preview(typeKey: string, locale: "en" | "id", payload: unknown) {
    const type = this.catalog.get(typeKey)
    if (!type) throw new Error(`Unknown notification type: ${typeKey}`)
    return { category: type.category, priority: type.priority, channels: type.defaultChannels, ...type.render(locale, type.payload.parse(payload)) }
  }

  purge(now = new Date()) {
    return this.repo.purge(now)
  }
}
