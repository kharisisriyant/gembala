import { Injectable } from "@nestjs/common"
import { and, eq, lt, or } from "drizzle-orm"
import { InjectDb, type Db, type Tx } from "../db/drizzle.module"
import { digestLog, digestPreferences, orgMemberships, users } from "../db/schema"

export type DigestRecipient = {
  userId: string
  orgId: string
  name: string
  email: string
  enabled: boolean
  locale: "en" | "id"
}

// A claim left `pending` longer than this means the process died mid-send.
const STALE_CLAIM_MS = 30 * 60_000

@Injectable()
export class DigestRepository {
  constructor(@InjectDb() private readonly db: Db) {}

  // Active users with an org membership, with their preferences (defaults when no row).
  async recipients(tx: Db | Tx = this.db): Promise<DigestRecipient[]> {
    const rows = await tx
      .select({
        userId: users.id,
        orgId: orgMemberships.orgId,
        name: users.name,
        email: users.email,
        enabled: digestPreferences.enabled,
        locale: digestPreferences.locale,
      })
      .from(orgMemberships)
      .innerJoin(users, eq(users.id, orgMemberships.userId))
      .leftJoin(digestPreferences, eq(digestPreferences.userId, users.id))
      .where(eq(users.authStatus, "active"))
    return rows.map((r) => ({ ...r, enabled: r.enabled ?? true, locale: r.locale === "en" ? "en" : "id" }))
  }

  async findPreferences(userId: string, tx: Db | Tx = this.db) {
    const [row] = await tx.select().from(digestPreferences).where(eq(digestPreferences.userId, userId))
    return row
  }

  async upsertPreferences(userId: string, prefs: { enabled: boolean; locale: "en" | "id" }, tx: Db | Tx = this.db) {
    await tx
      .insert(digestPreferences)
      .values({ userId, ...prefs })
      .onConflictDoUpdate({ target: digestPreferences.userId, set: { ...prefs, updatedAt: new Date() } })
  }

  // Takes ownership of (user, week) for sending. False when another run already
  // sent it, or is sending it right now. A `failed` or stale `pending` claim is retaken.
  async claim(userId: string, weekStart: string, tx: Db | Tx = this.db): Promise<boolean> {
    const stale = new Date(Date.now() - STALE_CLAIM_MS)
    const rows = await tx
      .insert(digestLog)
      .values({ userId, weekStart })
      .onConflictDoUpdate({
        target: [digestLog.userId, digestLog.weekStart],
        set: { status: "pending", error: null, attemptedAt: new Date() },
        setWhere: or(eq(digestLog.status, "failed"), and(eq(digestLog.status, "pending"), lt(digestLog.attemptedAt, stale))),
      })
      .returning({ id: digestLog.id })
    return rows.length > 0
  }

  async markSent(userId: string, weekStart: string, channel: "telegram" | "email", tx: Db | Tx = this.db) {
    await tx
      .update(digestLog)
      .set({ status: "sent", channel, error: null, sentAt: new Date() })
      .where(and(eq(digestLog.userId, userId), eq(digestLog.weekStart, weekStart)))
  }

  async markFailed(userId: string, weekStart: string, error: string, tx: Db | Tx = this.db) {
    await tx
      .update(digestLog)
      .set({ status: "failed", error: error.slice(0, 500) })
      .where(and(eq(digestLog.userId, userId), eq(digestLog.weekStart, weekStart)))
  }
}
