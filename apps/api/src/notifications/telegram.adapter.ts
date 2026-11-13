import { Injectable } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { clampTelegramText, escapeTelegramHtml } from "../telegram/telegram.client"
import { TelegramService } from "../telegram/telegram.service"
import type { ChannelAdapter, SendContext, SendResult } from "./notifications.adapter"
import { EndpointsRepository } from "./endpoints.repository"
import { buildWebLink } from "./notifications.links"
import { NotificationsRedis } from "./notifications.redis"

const CHAT_GAP_MS = 1_000
const MAX_GATE_WAITS = 5
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

@Injectable()
export class TelegramAdapter implements ChannelAdapter {
  readonly channel = "telegram" as const

  constructor(
    private readonly telegram: TelegramService,
    private readonly redis: NotificationsRedis,
    private readonly endpoints: EndpointsRepository,
    private readonly config: ConfigService,
  ) {}

  // A user who blocked the bot has no active link, so they show as not connected (TG-5).
  available(userId: string): Promise<boolean> {
    return this.telegram.hasActiveLink(userId)
  }

  async send(ctx: SendContext): Promise<SendResult> {
    const { notification } = ctx
    const locale = (await this.endpoints.emailTarget(notification.userId))?.locale ?? "id"
    const origin = this.config.getOrThrow<string>("WEB_ORIGIN")
    // Short summary plus a login-protected link; nothing sensitive goes into chat (TG-10).
    const text = clampTelegramText(`<b>${escapeTelegramHtml(notification.title)}</b>\n${escapeTelegramHtml(notification.body)}`)
    // Telegram rejects non-https button URLs (e.g. localhost), which would fail a good message.
    const buttonUrl = notification.link && origin.startsWith("https://") ? buildWebLink(origin, notification.link) : undefined

    // One message per second per chat, shared across workers and instances via Redis (TG-6).
    // One active link per user, so the user id identifies the chat.
    for (let waits = 0; ; waits++) {
      const wait = await this.redis.reserve(`notif:tg:chat:${notification.userId}`, CHAT_GAP_MS)
      if (wait === 0) break
      if (waits >= MAX_GATE_WAITS) return { kind: "retryable", code: "chat_throttle", retryAfterMs: wait }
      await sleep(wait)
    }

    const result = await this.telegram.pushToUser(notification.userId, {
      text,
      parseMode: "HTML",
      buttonUrl,
      buttonText: locale === "en" ? "Open" : "Buka",
    })
    switch (result.kind) {
      case "sent":
        return { kind: "accepted", providerMessageId: result.messageId }
      case "no_link":
        return { kind: "permanent", code: "not_connected" }
      default:
        return result
    }
  }
}
