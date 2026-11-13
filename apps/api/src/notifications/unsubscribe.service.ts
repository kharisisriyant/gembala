import { BadRequestException, Injectable } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { NOTIFICATION_DEFAULTS, type NotificationCategory } from "@gembala/shared"
import { verifyLink } from "./notifications.links"
import { PreferencesRepository } from "./preferences.repository"

// Email unsubscribe from a signed link, no login (PR-6). Applies to the whole category.
@Injectable()
export class UnsubscribeService {
  constructor(
    private readonly config: ConfigService,
    private readonly prefs: PreferencesRepository,
  ) {}

  private claims(token: string) {
    const claims = verifyLink(this.config.getOrThrow<string>("NOTIFICATION_LINK_SECRET"), token)
    if (!claims || claims.channel !== "email" || NOTIFICATION_DEFAULTS[claims.category].email.locked) {
      throw new BadRequestException("This unsubscribe link is not valid")
    }
    return claims
  }

  preview(token: string): { category: NotificationCategory } {
    return { category: this.claims(token).category }
  }

  async apply(token: string): Promise<void> {
    const { userId, category } = this.claims(token)
    await this.prefs.upsertPreference(userId, category, "email", false)
    await this.prefs.insertConsent({ userId, category, channel: "email", enabled: false, source: "email_link" })
  }
}
