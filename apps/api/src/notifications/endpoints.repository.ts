import { Injectable } from "@nestjs/common"
import { and, eq, inArray } from "drizzle-orm"
import { InjectDb, type Db } from "../db/drizzle.module"
import { channelEndpoints, notificationDeliveries, notifications, userSettings, users } from "../db/schema"

@Injectable()
export class EndpointsRepository {
  constructor(@InjectDb() private readonly db: Db) {}

  // The user's email address, locale and whether the provider suppressed it.
  async emailTarget(userId: string) {
    const [row] = await this.db
      .select({ address: users.email, locale: userSettings.locale, status: channelEndpoints.status })
      .from(users)
      .leftJoin(userSettings, eq(userSettings.userId, users.id))
      .leftJoin(channelEndpoints, and(eq(channelEndpoints.userId, users.id), eq(channelEndpoints.channel, "email")))
      .where(eq(users.id, userId))
    if (!row) return null
    return { address: row.address, locale: row.locale === "en" ? ("en" as const) : ("id" as const), bounced: row.status === "bounced" }
  }

  async markEmailBounced(userId: string, address: string) {
    await this.db
      .insert(channelEndpoints)
      .values({ userId, channel: "email", address, status: "bounced" })
      .onConflictDoUpdate({
        target: [channelEndpoints.userId, channelEndpoints.channel],
        set: { address, status: "bounced", updatedAt: new Date() },
      })
  }

  // Delivery behind a provider message id, with the recipient it was sent to.
  async deliveryByProviderId(providerMessageId: string) {
    const [row] = await this.db
      .select({ id: notificationDeliveries.id, status: notificationDeliveries.status, userId: notifications.userId, correlationId: notificationDeliveries.correlationId })
      .from(notificationDeliveries)
      .innerJoin(notifications, eq(notifications.id, notificationDeliveries.notificationId))
      .where(eq(notificationDeliveries.providerMessageId, providerMessageId))
    return row ?? null
  }

  // Provider callbacks only move a delivery that was accepted (sent/delivered).
  async setProviderStatus(id: string, status: "delivered" | "failed", errorCode?: string) {
    await this.db
      .update(notificationDeliveries)
      .set({ status, errorCode: errorCode ?? null, updatedAt: new Date() })
      .where(
        and(
          eq(notificationDeliveries.id, id),
          inArray(notificationDeliveries.status, status === "delivered" ? ["sent"] : ["sent", "delivered"]),
        ),
      )
  }
}
