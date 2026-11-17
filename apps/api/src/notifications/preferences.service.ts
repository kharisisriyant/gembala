import { BadRequestException, Inject, Injectable } from "@nestjs/common"
import {
  channelEnabled,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_DEFAULTS,
  type NotificationChannel,
  type NotificationPreferencesResponse,
  type NotificationPreferenceUpdateInput,
} from "@gembala/shared"
import { InjectDb, type Db } from "../db/drizzle.module"
import { TelegramService } from "../telegram/telegram.service"
import { EndpointsRepository } from "./endpoints.repository"
import { NOTIFICATION_CATALOG, type NotificationType } from "./notifications.catalog"
import { PreferencesRepository } from "./preferences.repository"

@Injectable()
export class PreferencesService {
  constructor(
    private readonly repo: PreferencesRepository,
    private readonly endpoints: EndpointsRepository,
    private readonly telegram: TelegramService,
    @InjectDb() private readonly db: Db,
    @Inject(NOTIFICATION_CATALOG) private readonly types: NotificationType[],
  ) {}

  async get(userId: string): Promise<NotificationPreferencesResponse> {
    const overrides = await this.repo.overrides(userId)
    // Product updates are opt-in marketing; hide the row until a type exists (D25).
    const categories = NOTIFICATION_CATEGORIES.filter(
      (category) => category !== "product_updates" || this.types.some((t) => t.category === category),
    ).map((category) => ({
      category,
      cells: Object.fromEntries(
        NOTIFICATION_CHANNELS.map((channel) => [
          channel,
          { enabled: channelEnabled(category, channel, overrides), locked: NOTIFICATION_DEFAULTS[category][channel].locked },
        ]),
      ) as Record<NotificationChannel, { enabled: boolean; locked: boolean }>,
    }))
    const email = await this.endpoints.emailTarget(userId)
    return {
      categories,
      channels: {
        email: { state: email?.bounced ? "bounced" : "connected", address: email?.address ?? "" },
        telegram: { state: await this.telegram.channelState(userId) },
      },
    }
  }

  // One cell at a time; every real change is logged as consent from the settings screen (PR-7).
  async update(userId: string, input: NotificationPreferenceUpdateInput): Promise<NotificationPreferencesResponse> {
    if (NOTIFICATION_DEFAULTS[input.category][input.channel].locked) {
      throw new BadRequestException("This setting can't be changed")
    }
    const overrides = await this.repo.overrides(userId)
    if (channelEnabled(input.category, input.channel, overrides) !== input.enabled) {
      await this.db.transaction(async (tx) => {
        await this.repo.upsertPreference(userId, input.category, input.channel, input.enabled, tx)
        await this.repo.insertConsent(
          { userId, category: input.category, channel: input.channel, enabled: input.enabled, source: "settings", actorUserId: userId },
          tx,
        )
      })
    }
    return this.get(userId)
  }
}
