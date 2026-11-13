import { Module } from "@nestjs/common"
import { NotificationsDispatcher } from "./notifications.dispatcher"
import { notificationProviders } from "./notifications.providers"
import { NotificationsScheduler } from "./notifications.scheduler"
import { NotificationsService } from "./notifications.service"

@Module({
  providers: [...notificationProviders, NotificationsScheduler],
  exports: [NotificationsService, NotificationsDispatcher],
})
export class NotificationsModule {}
