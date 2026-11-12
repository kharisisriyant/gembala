export abstract class MailService {
  abstract sendPasswordReset(to: string, link: string): Promise<void>
  abstract sendInvite(to: string, orgName: string, link: string): Promise<void>
  abstract sendWeeklyDigest(to: string, message: { subject: string; text: string; html: string }): Promise<void>
}
