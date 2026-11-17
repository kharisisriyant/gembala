import { Injectable } from "@nestjs/common"
import { and, desc, eq, gt, isNotNull, isNull } from "drizzle-orm"
import { NOTIFICATION_CATEGORIES } from "@gembala/shared"
import { InjectDb, type Db, type Tx } from "../db/drizzle.module"
import { consentEvents, telegramLinkCodes, telegramLinks, userNotificationPreferences } from "../db/schema"

@Injectable()
export class TelegramRepository {
  constructor(@InjectDb() private readonly db: Db) {}

  async findActiveLinkForUser(userId: string, tx: Db | Tx = this.db) {
    const [row] = await tx
      .select()
      .from(telegramLinks)
      .where(and(eq(telegramLinks.userId, userId), isNull(telegramLinks.revokedAt)))
      .limit(1)
    return row
  }

  async findActiveCodeForUser(userId: string, tx: Db | Tx = this.db) {
    const [row] = await tx
      .select()
      .from(telegramLinkCodes)
      .where(and(eq(telegramLinkCodes.userId, userId), gt(telegramLinkCodes.expiresAt, new Date())))
      .limit(1)
    return row
  }

  async insertCode(userId: string, code: string, expiresAt: Date, tx: Db | Tx = this.db) {
    const [row] = await tx.insert(telegramLinkCodes).values({ userId, code, expiresAt }).returning()
    return row
  }

  async revokeActiveLinkForUser(userId: string, reason = "user", tx: Db | Tx = this.db) {
    await tx
      .update(telegramLinks)
      .set({ revokedAt: new Date(), revokedReason: reason })
      .where(and(eq(telegramLinks.userId, userId), isNull(telegramLinks.revokedAt)))
  }

  // Returns the users whose link was revoked.
  async revokeActiveLinkByChatId(chatId: string, reason: string, tx: Db | Tx = this.db) {
    const rows = await tx
      .update(telegramLinks)
      .set({ revokedAt: new Date(), revokedReason: reason })
      .where(and(eq(telegramLinks.telegramChatId, chatId), isNull(telegramLinks.revokedAt)))
      .returning({ userId: telegramLinks.userId })
    return rows.map((r) => r.userId)
  }

  // Binds a chat to the code's user, replacing any older link for either side (TG-3),
  // and spends the code (TG-2), all in one transaction.
  async bindChat(input: { userId: string; telegramChatId: string; telegramUsername: string | null; codeId: string }) {
    await this.db.transaction(async (tx) => {
      await this.revokeActiveLinkByChatId(input.telegramChatId, "replaced", tx)
      await this.revokeActiveLinkForUser(input.userId, "replaced", tx)
      await tx.insert(telegramLinks).values({ userId: input.userId, telegramChatId: input.telegramChatId, telegramUsername: input.telegramUsername })
      await tx.delete(telegramLinkCodes).where(eq(telegramLinkCodes.id, input.codeId))
    })
  }

  // True when the user's most recent link ended because Telegram reported the bot blocked.
  async hasBlockedLink(userId: string, tx: Db | Tx = this.db) {
    const [row] = await tx
      .select({ reason: telegramLinks.revokedReason })
      .from(telegramLinks)
      .where(and(eq(telegramLinks.userId, userId), isNotNull(telegramLinks.revokedAt)))
      .orderBy(desc(telegramLinks.revokedAt))
      .limit(1)
    return row?.reason === "blocked"
  }

  // `/stop` is an opt-out: every category goes off for Telegram and the change is
  // logged (PR-7). Unlinking from settings is only a reachability change.
  async recordTelegramStop(userId: string, tx: Db | Tx = this.db) {
    await tx
      .insert(consentEvents)
      .values(NOTIFICATION_CATEGORIES.map((category) => ({ userId, category, channel: "telegram" as const, enabled: false, source: "bot_command" as const, actorUserId: userId })))
    await tx
      .insert(userNotificationPreferences)
      .values(NOTIFICATION_CATEGORIES.map((category) => ({ userId, category, channel: "telegram" as const, enabled: false })))
      .onConflictDoUpdate({
        target: [userNotificationPreferences.userId, userNotificationPreferences.category, userNotificationPreferences.channel],
        set: { enabled: false, updatedAt: new Date() },
      })
  }

  async findActiveLinkByChatId(chatId: string, tx: Db | Tx = this.db) {
    const [row] = await tx
      .select({ userId: telegramLinks.userId })
      .from(telegramLinks)
      .where(and(eq(telegramLinks.telegramChatId, chatId), isNull(telegramLinks.revokedAt)))
      .limit(1)
    return row
  }

  async findActiveLinkRowByChatId(chatId: string, tx: Db | Tx = this.db) {
    const [row] = await tx
      .select()
      .from(telegramLinks)
      .where(and(eq(telegramLinks.telegramChatId, chatId), isNull(telegramLinks.revokedAt)))
      .limit(1)
    return row
  }

  async findActiveCodeByCode(code: string, tx: Db | Tx = this.db) {
    const [row] = await tx
      .select()
      .from(telegramLinkCodes)
      .where(and(eq(telegramLinkCodes.code, code), gt(telegramLinkCodes.expiresAt, new Date())))
      .limit(1)
    return row
  }

  async insertLink(
    input: { userId: string; telegramChatId: string; telegramUsername: string | null },
    tx: Db | Tx = this.db,
  ) {
    await tx.insert(telegramLinks).values(input)
  }

  async deleteCode(id: string, tx: Db | Tx = this.db) {
    await tx.delete(telegramLinkCodes).where(eq(telegramLinkCodes.id, id))
  }
}
