import { Injectable } from "@nestjs/common"
import { and, count, desc, eq, isNull, lt, or } from "drizzle-orm"
import type { NotificationCategory } from "@gembala/shared"
import { InjectDb, type Db } from "../db/drizzle.module"
import { notifications } from "../db/schema"

export type InboxCursor = { createdAt: Date; id: string }

// Every query is scoped to (user, org): an inbox only shows the caller's own
// rows in the org they're currently signed into (SP-7).
@Injectable()
export class InboxRepository {
  constructor(@InjectDb() private readonly db: Db) {}

  list(userId: string, orgId: string, opts: { limit: number; unread?: boolean; category?: NotificationCategory; cursor?: InboxCursor }) {
    return this.db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.orgId, orgId),
          opts.unread ? isNull(notifications.readAt) : undefined,
          opts.category ? eq(notifications.category, opts.category) : undefined,
          opts.cursor
            ? or(
                lt(notifications.createdAt, opts.cursor.createdAt),
                and(eq(notifications.createdAt, opts.cursor.createdAt), lt(notifications.id, opts.cursor.id)),
              )
            : undefined,
        ),
      )
      .orderBy(desc(notifications.createdAt), desc(notifications.id))
      .limit(opts.limit)
  }

  async unreadCount(userId: string, orgId: string) {
    const [row] = await this.db
      .select({ value: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.orgId, orgId), isNull(notifications.readAt)))
    return row.value
  }

  // Null when the row doesn't exist or isn't the caller's.
  async setRead(id: string, userId: string, orgId: string, read: boolean) {
    const [row] = await this.db
      .update(notifications)
      .set({ readAt: read ? new Date() : null })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId), eq(notifications.orgId, orgId)))
      .returning()
    return row ?? null
  }

  async markAllRead(userId: string, orgId: string) {
    const rows = await this.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, userId), eq(notifications.orgId, orgId), isNull(notifications.readAt)))
      .returning({ id: notifications.id })
    return rows.length
  }
}
