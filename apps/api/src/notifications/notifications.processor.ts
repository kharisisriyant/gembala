import { Inject, Injectable, Logger } from "@nestjs/common"
import { channelEnabled, type NotificationChannel, type SkipReason } from "@gembala/shared"
import { CHANNEL_ADAPTERS, type ChannelAdapter } from "./notifications.adapter"
import { NotificationAccess } from "./notifications.access"
import { NotificationsRepository } from "./notifications.repository"

export type ProcessOutcome =
  | { kind: "done" }
  // Delivery stays open; BullMQ should retry after the backoff.
  | { kind: "retry"; code: string; retryAfterMs?: number }
  // Retries used up: recorded as failed.
  | { kind: "exhausted"; code: string }

@Injectable()
export class DeliveryProcessor {
  private readonly log = new Logger("NotificationDelivery")
  private readonly adapters: Map<NotificationChannel, ChannelAdapter>

  constructor(
    private readonly repo: NotificationsRepository,
    @Inject(CHANNEL_ADAPTERS) adapters: ChannelAdapter[],
    private readonly access: NotificationAccess,
  ) {
    this.adapters = new Map(adapters.map((a) => [a.channel, a]))
  }

  // Send-time checks live here, not in the router, so they also cover reconciled
  // and replayed jobs (PR-4, RT-2, RT-9, RL-6).
  async process(deliveryId: string, attempt: { made: number; max: number }, now = new Date()): Promise<ProcessOutcome> {
    const ctx = await this.repo.deliveryContext(deliveryId)
    if (!ctx) return { kind: "done" }
    const { delivery, notification, payload } = ctx
    if (!["pending", "queued"].includes(delivery.status)) return { kind: "done" } // duplicate job
    const tag = `delivery=${delivery.id} channel=${delivery.channel} correlation=${delivery.correlationId}`

    const skip = async (reason: SkipReason): Promise<ProcessOutcome> => {
      await this.repo.finishDelivery(delivery.id, { status: "skipped", skipReason: reason })
      this.log.log(`skip ${tag} reason=${reason}`)
      return { kind: "done" }
    }

    const switches = await this.repo.killSwitches()
    if (switches.some((s) => (s.typeKey === null || s.typeKey === notification.typeKey) && (s.channel === null || s.channel === delivery.channel))) {
      return skip("kill_switch")
    }
    if (notification.expiresAt <= now) return skip("expired")

    const users = await this.repo.routingUsers([notification.userId], notification.orgId)
    if (users.length === 0 || !(await this.access.allowed(notification.typeKey, notification.userId, notification.orgId, payload))) {
      return skip("no_access")
    }

    const overrides = await this.repo.preferenceOverrides([notification.userId])
    if (!channelEnabled(notification.category, delivery.channel, overrides)) return skip("preference")

    const adapter = this.adapters.get(delivery.channel)
    if (!adapter || !(await adapter.available(notification.userId))) return skip("not_connected")

    await this.repo.recordAttempt(delivery.id)
    const result = await adapter.send({
      deliveryId: delivery.id,
      correlationId: delivery.correlationId,
      notification: {
        id: notification.id,
        orgId: notification.orgId,
        userId: notification.userId,
        typeKey: notification.typeKey,
        category: notification.category,
        title: notification.title,
        body: notification.body,
        link: notification.link,
      },
    })

    if (result.kind === "accepted") {
      await this.repo.finishDelivery(delivery.id, { status: "sent", providerMessageId: result.providerMessageId })
      this.log.log(`sent ${tag}`)
      return { kind: "done" }
    }
    if (result.kind === "permanent") {
      await this.repo.finishDelivery(delivery.id, { status: "failed", errorCode: result.code })
      this.log.error(`failed ${tag} code=${result.code} permanent`)
      return { kind: "done" }
    }
    if (attempt.made >= attempt.max) {
      await this.repo.finishDelivery(delivery.id, { status: "failed", errorCode: result.code })
      this.log.error(`failed ${tag} code=${result.code} retries exhausted`)
      return { kind: "exhausted", code: result.code }
    }
    this.log.warn(`retry ${tag} code=${result.code} attempt=${attempt.made}/${attempt.max}`)
    return { kind: "retry", code: result.code, retryAfterMs: result.retryAfterMs }
  }
}
