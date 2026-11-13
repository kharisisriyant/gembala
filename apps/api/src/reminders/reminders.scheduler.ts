import { Injectable } from "@nestjs/common"
import { Cron } from "@nestjs/schedule"
import { APP_TIME_ZONE } from "@gembala/shared"
import { RemindersService } from "./reminders.service"

// 08:00 Asia/Jakarta every day. Idempotent keys make a second instance or a
// restart harmless.
@Injectable()
export class RemindersScheduler {
  constructor(private readonly reminders: RemindersService) {}

  @Cron("0 8 * * *", { timeZone: APP_TIME_ZONE })
  daily() {
    return this.reminders.runDaily()
  }
}
