import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { Resend } from "resend"
import { MailService } from "./mail.service"

const escapeHtml = (value: string) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;")

@Injectable()
export class ResendMailService extends MailService {
  private readonly logger = new Logger(ResendMailService.name)
  private readonly resend: Resend
  private readonly from: string

  constructor(config: ConfigService) {
    super()
    this.resend = new Resend(config.getOrThrow<string>("RESEND_API_KEY"))
    const fromName = config.getOrThrow<string>("RESEND_FROM_NAME")
    const fromEmail = config.getOrThrow<string>("RESEND_FROM_EMAIL")
    this.from = `${fromName} <${fromEmail}>`
  }

  async sendPasswordReset(to: string, link: string): Promise<void> {
    await this.send({
      to,
      subject: "Reset your Gembala password",
      text: `Reset your Gembala password by opening this link: ${link}\n\nThis link expires in 1 hour. If you did not request a password reset, you can safely ignore this email.`,
      html: `<p>Reset your Gembala password by selecting the link below.</p><p><a href="${escapeHtml(link)}">Reset password</a></p><p>This link expires in 1 hour. If you did not request a password reset, you can safely ignore this email.</p>`,
    })
  }

  async sendInvite(to: string, orgName: string, link: string): Promise<void> {
    const escapedOrgName = escapeHtml(orgName)
    await this.send({
      to,
      subject: `You're invited to join ${orgName} on Gembala`,
      text: `You've been invited to join ${orgName} on Gembala. Accept your invitation here: ${link}\n\nThis link expires in 7 days.`,
      html: `<p>You've been invited to join <strong>${escapedOrgName}</strong> on Gembala.</p><p><a href="${escapeHtml(link)}">Accept invitation</a></p><p>This link expires in 7 days.</p>`,
    })
  }

  private async send(message: { to: string; subject: string; text: string; html: string }): Promise<void> {
    const { error } = await this.resend.emails.send({ from: this.from, ...message })
    if (!error) return

    this.logger.error(`Resend failed to send email to ${message.to}: ${error.message}`)
    throw new ServiceUnavailableException("email could not be sent")
  }
}
