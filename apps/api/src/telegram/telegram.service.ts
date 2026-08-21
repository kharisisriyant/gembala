import { Injectable, Logger, type OnModuleInit } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { randomBytes } from "node:crypto"
import { and, eq, gt, isNull } from "drizzle-orm"
import type { TelegramLinkStatusResponse } from "@gembala/shared"
import { InjectDb, type Db } from "../db/drizzle.module"
import { telegramLinkCodes, telegramLinks } from "../db/schema"
import type { AuthContext } from "../authz/auth-context"

const CODE_TTL_MS = 10 * 60 * 1000

export type TelegramUpdate = {
  message?: {
    text?: string
    chat: { id: number }
    from?: { username?: string }
  }
}

@Injectable()
export class TelegramService implements OnModuleInit {
  private readonly logger = new Logger("Telegram")
  private readonly token?: string
  private readonly botUsername?: string
  private readonly webhookSecret?: string
  private readonly webhookUrl?: string

  constructor(
    @InjectDb() private readonly db: Db,
    private readonly config: ConfigService,
  ) {
    this.token = this.config.get<string>("TELEGRAM_BOT_TOKEN")
    this.botUsername = this.config.get<string>("TELEGRAM_BOT_USERNAME")
    this.webhookSecret = this.config.get<string>("TELEGRAM_WEBHOOK_SECRET")
    this.webhookUrl = this.config.get<string>("TELEGRAM_WEBHOOK_URL")
  }

  get isConfigured(): boolean {
    return Boolean(this.token)
  }

  // Self-registers the webhook on boot when fully configured. Silent no-op
  // otherwise — the rest of the app must work with the bot absent.
  async onModuleInit(): Promise<void> {
    if (!this.token || !this.webhookUrl || !this.webhookSecret) {
      this.logger.log("Telegram bot not configured — skipping webhook registration")
      return
    }
    const target = `${this.webhookUrl}/api/telegram/webhook/${this.webhookSecret}`
    try {
      const res = await fetch(`https://api.telegram.org/bot${this.token}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: target }),
      })
      const data = (await res.json()) as { ok: boolean; description?: string }
      if (!data.ok) this.logger.warn(`setWebhook failed: ${data.description}`)
      else this.logger.log(`Telegram webhook registered at ${target}`)
    } catch (err) {
      this.logger.warn(`setWebhook request failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  async getStatus(auth: AuthContext): Promise<TelegramLinkStatusResponse> {
    const [link] = await this.db
      .select()
      .from(telegramLinks)
      .where(and(eq(telegramLinks.userId, auth.userId), isNull(telegramLinks.revokedAt)))
      .limit(1)

    if (link) {
      return { linked: true, telegramUsername: link.telegramUsername }
    }

    const [existing] = await this.db
      .select()
      .from(telegramLinkCodes)
      .where(and(eq(telegramLinkCodes.userId, auth.userId), gt(telegramLinkCodes.expiresAt, new Date())))
      .limit(1)

    const codeRow = existing ?? (await this.createCode(auth.userId))

    return {
      linked: false,
      code: codeRow.code,
      expiresAt: codeRow.expiresAt.toISOString(),
      botConfigured: this.isConfigured,
      botUsername: this.botUsername ?? null,
    }
  }

  async revoke(auth: AuthContext): Promise<void> {
    await this.db
      .update(telegramLinks)
      .set({ revokedAt: new Date() })
      .where(and(eq(telegramLinks.userId, auth.userId), isNull(telegramLinks.revokedAt)))
  }

  async handleUpdate(update: TelegramUpdate): Promise<void> {
    const message = update.message
    if (!message?.text) return

    const chatId = String(message.chat.id)
    const username = message.from?.username ?? null
    const text = message.text.trim()

    if (text === "/start") {
      await this.reply(
        chatId,
        "Welcome! Open Integrations in Gembala and send me /link <code> to connect your account.",
      )
      return
    }

    const match = /^\/link\s+(\S+)$/i.exec(text)
    if (!match) {
      await this.reply(chatId, "Send /link <code> from the Integrations page to connect your account.")
      return
    }

    await this.consumeCode(chatId, username, match[1].toUpperCase())
  }

  private async createCode(userId: string) {
    const code = randomBytes(4).toString("hex").toUpperCase()
    const expiresAt = new Date(Date.now() + CODE_TTL_MS)
    const [row] = await this.db.insert(telegramLinkCodes).values({ userId, code, expiresAt }).returning()
    return row
  }

  private async consumeCode(chatId: string, username: string | null, code: string): Promise<void> {
    const [alreadyLinked] = await this.db
      .select()
      .from(telegramLinks)
      .where(and(eq(telegramLinks.telegramChatId, chatId), isNull(telegramLinks.revokedAt)))
      .limit(1)
    if (alreadyLinked) {
      await this.reply(chatId, "This Telegram account is already linked.")
      return
    }

    const [codeRow] = await this.db
      .select()
      .from(telegramLinkCodes)
      .where(and(eq(telegramLinkCodes.code, code), gt(telegramLinkCodes.expiresAt, new Date())))
      .limit(1)
    if (!codeRow) {
      await this.reply(chatId, "That code is invalid or expired. Generate a new one from the Integrations page.")
      return
    }

    try {
      await this.db.insert(telegramLinks).values({
        userId: codeRow.userId,
        telegramChatId: chatId,
        telegramUsername: username,
      })
    } catch {
      // partial unique index on telegram_chat_id caught a race
      await this.reply(chatId, "This Telegram account is already linked to another user.")
      return
    }

    await this.db.delete(telegramLinkCodes).where(eq(telegramLinkCodes.id, codeRow.id))
    await this.reply(chatId, "Connected! Your Gembala account is now linked.")
  }

  private async reply(chatId: string, text: string): Promise<void> {
    if (!this.token) return
    await fetch(`https://api.telegram.org/bot${this.token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    })
  }
}
