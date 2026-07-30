import { Injectable, Logger } from "@nestjs/common"
import { MailService } from "./mail.service"

// Dev mailer: logs the links instead of sending email. Swap the provider in
// mail.module.ts for a real implementation (Resend, SMTP, ...) later.
@Injectable()
export class ConsoleMailService extends MailService {
  private readonly logger = new Logger("Mail")

  async sendPasswordReset(to: string, link: string): Promise<void> {
    this.logger.log(`\n┌─ Password reset for ${to}\n└─ ${link}`)
  }

  async sendInvite(to: string, orgName: string, link: string): Promise<void> {
    this.logger.log(`\n┌─ Invite for ${to} to join "${orgName}"\n└─ ${link}`)
  }
}
