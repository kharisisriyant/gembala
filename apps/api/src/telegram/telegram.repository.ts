import { Injectable } from "@nestjs/common"
import { and, eq, gt, isNull } from "drizzle-orm"
import { InjectDb, type Db, type Tx } from "../db/drizzle.module"
import { telegramLinkCodes, telegramLinks } from "../db/schema"

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

  async revokeActiveLinkForUser(userId: string, tx: Db | Tx = this.db) {
    await tx
      .update(telegramLinks)
      .set({ revokedAt: new Date() })
      .where(and(eq(telegramLinks.userId, userId), isNull(telegramLinks.revokedAt)))
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
