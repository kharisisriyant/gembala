import { Injectable, Logger } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { Cron } from "@nestjs/schedule"
import { APP_TIME_ZONE } from "@gembala/shared"
import { NotificationsService } from "./notifications.service"

// Daily retention purge (D7). Only instances running notification workers do it.
@Injectable()
export class NotificationsScheduler {
  private readonly log = new Logger("NotificationsPurge")

  constructor(
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron("30 3 * * *", { timeZone: APP_TIME_ZONE })
  async purge() {
    if (this.config.get<boolean>("NOTIFICATIONS_WORKERS") !== true) return
    this.log.log(JSON.stringify(await this.notifications.purge()))
  }
}
