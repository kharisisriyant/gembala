import { Module } from "@nestjs/common"
import { EmailController } from "./email.controllers"
import { InboxController } from "./inbox.controller"
import { InboxRepository } from "./inbox.repository"
import { InboxService } from "./inbox.service"
import { NotificationsDispatcher } from "./notifications.dispatcher"
import { notificationProviders } from "./notifications.providers"
import { NotificationsScheduler } from "./notifications.scheduler"
import { NotificationsService } from "./notifications.service"
import { ResendWebhookService } from "./resend-webhook.service"
import { UnsubscribeService } from "./unsubscribe.service"

@Module({
  controllers: [InboxController, EmailController],
  providers: [...notificationProviders, NotificationsScheduler, InboxService, InboxRepository, UnsubscribeService, ResendWebhookService],
  exports: [NotificationsService, NotificationsDispatcher],
})
export class NotificationsModule {}
