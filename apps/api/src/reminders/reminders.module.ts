import { Module } from "@nestjs/common"
import { AttentionModule } from "../attention/attention.module"
import { NotificationsModule } from "../notifications/notifications.module"
import { RemindersRepository } from "./reminders.repository"
import { RemindersScheduler } from "./reminders.scheduler"
import { RemindersService } from "./reminders.service"

@Module({
  imports: [AttentionModule, NotificationsModule],
  providers: [RemindersService, RemindersRepository, RemindersScheduler],
})
export class RemindersModule {}
