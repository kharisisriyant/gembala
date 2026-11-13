import { Injectable, NotFoundException } from "@nestjs/common"
import type {
  NotificationCategory,
  NotificationItemResponse,
  NotificationListResponse,
  NotificationReadAllResponse,
  NotificationUnreadCountResponse,
} from "@gembala/shared"
import { InboxRepository, type InboxCursor } from "./inbox.repository"

type Row = Awaited<ReturnType<InboxRepository["list"]>>[number]

export function encodeCursor(row: Pick<Row, "createdAt" | "id">): string {
  return Buffer.from(`${row.createdAt.toISOString()}|${row.id}`).toString("base64url")
}

export function decodeCursor(raw: string): InboxCursor | null {
  const [iso, id] = Buffer.from(raw, "base64url").toString().split("|")
  const createdAt = new Date(iso)
  return id && !Number.isNaN(createdAt.getTime()) ? { createdAt, id } : null
}

const toItem = (row: Row): NotificationItemResponse => ({
  id: row.id,
  typeKey: row.typeKey,
  category: row.category,
  title: row.title,
  body: row.body,
  link: row.link,
  readAt: row.readAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
})

@Injectable()
export class InboxService {
  constructor(private readonly repo: InboxRepository) {}

  async list(
    auth: { userId: string; orgId: string },
    query: { cursor?: string; limit: number; unread?: boolean; category?: NotificationCategory },
  ): Promise<NotificationListResponse> {
    const cursor = query.cursor ? decodeCursor(query.cursor) : undefined
    // A tampered cursor restarts from the newest item instead of failing.
    const rows = await this.repo.list(auth.userId, auth.orgId, {
      limit: query.limit + 1,
      unread: query.unread,
      category: query.category,
      cursor: cursor ?? undefined,
    })
    const page = rows.slice(0, query.limit)
    return { items: page.map(toItem), nextCursor: rows.length > query.limit ? encodeCursor(page[page.length - 1]) : null }
  }

  async unreadCount(auth: { userId: string; orgId: string }): Promise<NotificationUnreadCountResponse> {
    return { count: await this.repo.unreadCount(auth.userId, auth.orgId) }
  }

  async setRead(auth: { userId: string; orgId: string }, id: string, read: boolean): Promise<NotificationItemResponse> {
    const row = await this.repo.setRead(id, auth.userId, auth.orgId, read)
    if (!row) throw new NotFoundException("Notification not found")
    return toItem(row)
  }

  async markAllRead(auth: { userId: string; orgId: string }): Promise<NotificationReadAllResponse> {
    return { updated: await this.repo.markAllRead(auth.userId, auth.orgId) }
  }
}
