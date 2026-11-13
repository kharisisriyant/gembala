import { Injectable, Logger, type OnModuleInit } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { randomBytes } from "node:crypto"
import type { TelegramLinkStatusResponse } from "@gembala/shared"
import { sendTelegramMessage } from "./telegram.client"
import type { AuthContext } from "../authz/auth-context"
import { AuthContextService } from "../authz/auth-context.service"
import { TelegramAgentService } from "./telegram-agent.service"
import { TelegramRepository } from "./telegram.repository"

const CODE_TTL_MS = 10 * 60 * 1000

export type TelegramUpdate = {
  message?: {
    text?: string
    chat: { id: number; type?: string }
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
    private readonly links: TelegramRepository,
    private readonly config: ConfigService,
    private readonly authContext: AuthContextService,
    private readonly agent: TelegramAgentService,
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
    // Telegram echoes secret_token in a header on every call; the controller verifies it (TG-7).
    const target = `${this.webhookUrl}/api/telegram/webhook`
    try {
      const res = await fetch(`https://api.telegram.org/bot${this.token}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: target, secret_token: this.webhookSecret }),
      })
      const data = (await res.json()) as { ok: boolean; description?: string }
      if (!data.ok) this.logger.warn(`setWebhook failed: ${data.description}`)
      else this.logger.log(`Telegram webhook registered at ${target}`)
    } catch (err) {
      this.logger.warn(`setWebhook request failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  async getStatus(auth: AuthContext): Promise<TelegramLinkStatusResponse> {
    const link = await this.links.findActiveLinkForUser(auth.userId)

    if (link) {
      return { linked: true, telegramUsername: link.telegramUsername }
    }

    const existing = await this.links.findActiveCodeForUser(auth.userId)

    const codeRow = existing ?? (await this.createCode(auth.userId))

    return {
      linked: false,
      disconnected: await this.links.hasBlockedLink(auth.userId),
      code: codeRow.code,
      expiresAt: codeRow.expiresAt.toISOString(),
      botConfigured: this.isConfigured,
      botUsername: this.botUsername ?? null,
    }
  }

  async revoke(auth: AuthContext): Promise<void> {
    await this.links.revokeActiveLinkForUser(auth.userId)
  }

  async handleUpdate(update: TelegramUpdate): Promise<void> {
    const message = update.message
    if (!message?.text) return

    // Private chats only (TG-11): never answer or link from groups and channels.
    if (message.chat.type && message.chat.type !== "private") return

    const chatId = String(message.chat.id)
    const username = message.from?.username ?? null
    const text = message.text.trim()

    // `/start <code>` is the deep link from the app (t.me/<bot>?start=<code>); `/link <code>` still works.
    const linkMatch = /^\/(?:start|link)(?:@\w+)?\s+(\S+)$/i.exec(text)
    if (linkMatch) {
      await this.consumeCode(chatId, username, linkMatch[1].toUpperCase())
      return
    }

    if (/^\/start(?:@\w+)?$/i.test(text)) {
      await this.reply(
        chatId,
        "Welcome! Open Integrations in gembala and use the Connect Telegram button, or send me /link <code> to connect your account.",
      )
      return
    }

    if (/^\/stop(?:@\w+)?$/i.test(text)) {
      await this.stop(chatId)
      return
    }

    await this.handleFreeText(chatId, text)
  }

  private async handleFreeText(chatId: string, text: string): Promise<void> {
    const link = await this.links.findActiveLinkByChatId(chatId)

    if (!link) {
      await this.reply(
        chatId,
        "Your Telegram account isn't linked yet. Send /link <code> from the Integrations page to connect it.",
      )
      return
    }

    if (!this.agent.isConfigured) {
      await this.reply(chatId, "The AI assistant isn't configured yet.")
      return
    }

    const auth = await this.authContext.load(link.userId)
    if (!auth) {
      await this.reply(chatId, "Sorry, something went wrong. Please try again.")
      return
    }

    const reply = await this.agent.processMessage(auth, chatId, text)
    await this.reply(chatId, reply, { markdown: true })
  }

  private async createCode(userId: string) {
    const code = randomBytes(4).toString("hex").toUpperCase()
    const expiresAt = new Date(Date.now() + CODE_TTL_MS)
    return this.links.insertCode(userId, code, expiresAt)
  }

  private async consumeCode(chatId: string, username: string | null, code: string): Promise<void> {
    const codeRow = await this.links.findActiveCodeByCode(code)
    if (!codeRow) {
      await this.reply(chatId, "That code is invalid or expired. Generate a new one from the Integrations page.")
      return
    }
    // Re-linking replaces any older link for this chat or this user (TG-3).
    await this.links.bindChat({ userId: codeRow.userId, telegramChatId: chatId, telegramUsername: username, codeId: codeRow.id })
    await this.reply(chatId, "Connected! Your gembala account is now linked.")
  }

  // `/stop`: unlink this chat and turn Telegram notifications off (TG-4).
  private async stop(chatId: string): Promise<void> {
    const userIds = await this.links.revokeActiveLinkByChatId(chatId, "stop")
    for (const userId of userIds) await this.links.recordTelegramStop(userId)
    await this.reply(
      chatId,
      userIds.length > 0
        ? "Disconnected. You won't get notifications here anymore. Link again from gembala any time."
        : "This chat isn't linked to a gembala account.",
    )
  }

  async hasActiveLink(userId: string): Promise<boolean> {
    return this.isConfigured && Boolean(await this.links.findActiveLinkForUser(userId))
  }

  // Outbound push for notifications. Classified so the delivery worker can retry
  // or give up; a 403 means the user blocked the bot, so the link is retired (TG-5).
  async pushToUser(
    userId: string,
    message: { text: string; parseMode?: "HTML"; buttonUrl?: string; buttonText?: string },
  ): Promise<
    | { kind: "no_link" }
    | { kind: "sent"; messageId: string }
    | { kind: "retryable"; code: string; retryAfterMs?: number }
    | { kind: "permanent"; code: string }
  > {
    if (!this.token) return { kind: "no_link" }
    const link = await this.links.findActiveLinkForUser(userId)
    if (!link) return { kind: "no_link" }
    const res = await sendTelegramMessage(this.token, { chatId: link.telegramChatId, ...message })
    if (res.ok) return { kind: "sent", messageId: res.messageId }
    if (res.status === 403) {
      await this.links.revokeActiveLinkByChatId(link.telegramChatId, "blocked")
      this.logger.warn(`bot blocked by user ${userId}; link retired`)
      return { kind: "permanent", code: "blocked" }
    }
    if (res.status === 0 || res.status === 429 || res.status >= 500) {
      return { kind: "retryable", code: String(res.status || "network"), retryAfterMs: res.retryAfterMs }
    }
    this.logger.warn(`sendMessage to user ${userId} rejected: HTTP ${res.status} ${res.description}`)
    return { kind: "permanent", code: String(res.status) }
  }

  // Outbound push for the weekly digest. False = not delivered, so the caller
  // can fall back to another channel.
  async sendToUser(userId: string, text: string): Promise<boolean> {
    return (await this.pushToUser(userId, { text })).kind === "sent"
  }

  private async reply(chatId: string, text: string, opts?: { markdown?: boolean }): Promise<void> {
    if (!this.token) return
    await fetch(`https://api.telegram.org/bot${this.token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        ...(opts?.markdown ? { parse_mode: "Markdown" } : {}),
      }),
    })
  }
}
