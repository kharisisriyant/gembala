import { Injectable } from "@nestjs/common"
import { Cron } from "@nestjs/schedule"
import { APP_TIME_ZONE } from "@gembala/shared"
import { GoogleCalendarService } from "./google-calendar.service"

// Nightly full sync: repairs anything a failed per-event push left behind.
@Injectable()
export class GoogleCalendarScheduler {
  constructor(private readonly calendar: GoogleCalendarService) {}

  @Cron("0 3 * * *", { timeZone: APP_TIME_ZONE })
  async reconcile(): Promise<void> {
    await this.calendar.reconcileAll()
  }
}
