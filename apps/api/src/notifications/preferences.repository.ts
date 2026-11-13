import { Injectable } from "@nestjs/common"
import type { NotificationCategory, NotificationChannel } from "@gembala/shared"
import { InjectDb, type Db, type Tx } from "../db/drizzle.module"
import { consentEvents, userNotificationPreferences } from "../db/schema"

export type ConsentSource = "settings" | "email_link" | "bot_command"

@Injectable()
export class PreferencesRepository {
  constructor(@InjectDb() private readonly db: Db) {}

  async upsertPreference(userId: string, category: NotificationCategory, channel: NotificationChannel, enabled: boolean, tx: Db | Tx = this.db) {
    await tx
      .insert(userNotificationPreferences)
      .values({ userId, category, channel, enabled })
      .onConflictDoUpdate({
        target: [userNotificationPreferences.userId, userNotificationPreferences.category, userNotificationPreferences.channel],
        set: { enabled, updatedAt: new Date() },
      })
  }

  async insertConsent(
    values: { userId: string; category: NotificationCategory; channel: NotificationChannel; enabled: boolean; source: ConsentSource; actorUserId?: string },
    tx: Db | Tx = this.db,
  ) {
    await tx.insert(consentEvents).values({ ...values, actorUserId: values.actorUserId ?? null })
  }
}
