export abstract class MailService {
  abstract sendPasswordReset(to: string, link: string): Promise<void>
  abstract sendInvite(to: string, orgName: string, link: string): Promise<void>
}
