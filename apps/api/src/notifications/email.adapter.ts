import { Injectable, Logger } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { MailSendError, MailService } from "../mail/mail.service"
import type { ChannelAdapter, SendContext, SendResult } from "./notifications.adapter"
import { renderEmail } from "./email.render"
import { EndpointsRepository } from "./endpoints.repository"
import { buildWebLink, signLink } from "./notifications.links"

@Injectable()
export class EmailAdapter implements ChannelAdapter {
  readonly channel = "email" as const
  private readonly log = new Logger("EmailAdapter")

  constructor(
    private readonly mail: MailService,
    private readonly endpoints: EndpointsRepository,
    private readonly config: ConfigService,
  ) {}

  // Reachable unless the provider reported a hard bounce or complaint (EM-3, EM-4).
  async available(userId: string): Promise<boolean> {
    const target = await this.endpoints.emailTarget(userId)
    return target !== null && !target.bounced
  }

  async send(ctx: SendContext): Promise<SendResult> {
    const target = await this.endpoints.emailTarget(ctx.notification.userId)
    if (!target || target.bounced) return { kind: "permanent", code: "suppressed" }

    const origin = this.config.getOrThrow<string>("WEB_ORIGIN")
    const { category } = ctx.notification
    // Security and transactional mail has no unsubscribe: users can't opt out of it (EM-5).
    const canUnsubscribe = category !== "security" && category !== "transactional"
    const token = canUnsubscribe
      ? signLink(this.config.getOrThrow<string>("NOTIFICATION_LINK_SECRET"), { userId: ctx.notification.userId, category, channel: "email" })
      : null

    const { subject, html, text } = renderEmail({
      title: ctx.notification.title,
      body: ctx.notification.body,
      link: ctx.notification.link ? buildWebLink(origin, ctx.notification.link) : null,
      locale: target.locale,
      preferencesUrl: buildWebLink(origin, "/profile"),
      unsubscribeUrl: token ? buildWebLink(origin, `/unsubscribe?token=${token}`) : null,
    })
    // RFC 8058 one-click: mail clients POST straight to the API, no login or page.
    const headers: Record<string, string> = token
      ? {
          "List-Unsubscribe": `<${this.config.getOrThrow<string>("API_PUBLIC_URL").replace(/\/$/, "")}/notifications/unsubscribe?token=${token}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        }
      : {}

    try {
      const { id } = await this.mail.sendNotification(target.address, { subject, html, text, headers })
      return { kind: "accepted", providerMessageId: id }
    } catch (err) {
      if (err instanceof MailSendError) {
        this.log.warn(`send failed delivery=${ctx.deliveryId} correlation=${ctx.correlationId} code=${err.code} retryable=${err.retryable}`)
        return err.retryable ? { kind: "retryable", code: err.code, retryAfterMs: err.retryAfterMs } : { kind: "permanent", code: err.code }
      }
      throw err
    }
  }
}
