// Raised by sendNotification so the delivery worker can tell a retry-worthy
// failure (timeout, 429, 5xx) from a permanent one (bad address, rejected).
export class MailSendError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly code: string,
    readonly retryAfterMs?: number,
  ) {
    super(message)
    this.name = "MailSendError"
  }
}

export type NotificationMail = {
  subject: string
  text: string
  html: string
  headers?: Record<string, string>
}

export abstract class MailService {
  abstract sendPasswordReset(to: string, link: string): Promise<void>
  abstract sendInvite(to: string, orgName: string, link: string): Promise<void>
  // Returns the provider message id when there is one. Throws MailSendError.
  abstract sendNotification(to: string, message: NotificationMail): Promise<{ id?: string }>
}
