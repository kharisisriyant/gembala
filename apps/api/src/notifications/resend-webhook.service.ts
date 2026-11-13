import { Injectable, Logger, UnauthorizedException } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { Resend } from "resend"
import { EndpointsRepository } from "./endpoints.repository"

// Provider callbacks for email (EM-4). Matches by provider message id, never by
// the address in the payload, so a forged `to` cannot suppress someone else.
@Injectable()
export class ResendWebhookService {
  private readonly log = new Logger("ResendWebhook")
  // verify() is pure signature checking; the key is never used for requests here.
  private readonly resend = new Resend("re_webhook_verify_only")

  constructor(
    private readonly config: ConfigService,
    private readonly endpoints: EndpointsRepository,
  ) {}

  async handle(rawBody: string, headers: Record<string, string | string[] | undefined>): Promise<void> {
    const secret = this.config.get<string>("RESEND_WEBHOOK_SECRET")
    if (!secret) throw new UnauthorizedException("webhook not configured")
    let event: ReturnType<Resend["webhooks"]["verify"]>
    try {
      const header = (name: string) => {
        const v = headers[name]
        return typeof v === "string" ? v : ""
      }
      event = this.resend.webhooks.verify({
        payload: rawBody,
        headers: { id: header("svix-id"), timestamp: header("svix-timestamp"), signature: header("svix-signature") },
        webhookSecret: secret,
      })
    } catch {
      throw new UnauthorizedException("invalid signature")
    }

    if (event.type !== "email.delivered" && event.type !== "email.bounced" && event.type !== "email.complained") return
    const delivery = await this.endpoints.deliveryByProviderId(event.data.email_id)
    if (!delivery) return // not one of ours (or already purged)
    const tag = `delivery=${delivery.id} correlation=${delivery.correlationId}`

    if (event.type === "email.delivered") {
      await this.endpoints.setProviderStatus(delivery.id, "delivered")
      return
    }
    const hard = event.type === "email.complained" || event.data.bounce.type === "Permanent"
    await this.endpoints.setProviderStatus(delivery.id, "failed", hard && event.type === "email.bounced" ? "bounced" : event.type === "email.complained" ? "complained" : "soft_bounce")
    if (hard) {
      await this.endpoints.markEmailBounced(delivery.userId, event.data.to[0] ?? "")
      this.log.warn(`suppressed email ${tag} reason=${event.type}`)
    }
  }
}
