import { Module } from "@nestjs/common"
import { InboxController } from "./inbox.controller"
import { InboxRepository } from "./inbox.repository"
import { InboxService } from "./inbox.service"
import { NotificationsDispatcher } from "./notifications.dispatcher"
import { notificationProviders } from "./notifications.providers"
import { NotificationsScheduler } from "./notifications.scheduler"
import { NotificationsService } from "./notifications.service"

@Module({
  controllers: [InboxController],
  providers: [...notificationProviders, NotificationsScheduler, InboxService, InboxRepository],
  exports: [NotificationsService, NotificationsDispatcher],
})
export class NotificationsModule {}
