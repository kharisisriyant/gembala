import { Injectable } from "@nestjs/common"
import { Cron } from "@nestjs/schedule"
import { APP_TIME_ZONE } from "@gembala/shared"
import { DigestService } from "./digest.service"

// Monday 07:00 Asia/Jakarta, plus a 09:00 pass that retries failures. Both are
// the same idempotent run, so nothing is ever sent twice.
@Injectable()
export class DigestScheduler {
  constructor(private readonly digest: DigestService) {}

  @Cron("0 7 * * 1", { timeZone: APP_TIME_ZONE })
  weekly(): Promise<number> {
    return this.digest.runWeekly()
  }

  @Cron("0 9 * * 1", { timeZone: APP_TIME_ZONE })
  retry(): Promise<number> {
    return this.digest.runWeekly()
  }
}
