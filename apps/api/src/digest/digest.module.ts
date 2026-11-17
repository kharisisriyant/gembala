import { Module } from "@nestjs/common"
import { AttentionModule } from "../attention/attention.module"
import { CareRequestsModule } from "../care-requests/care-requests.module"
import { NotificationsModule } from "../notifications/notifications.module"
import { DigestController } from "./digest.controller"
import { DigestRepository } from "./digest.repository"
import { DigestScheduler } from "./digest.scheduler"
import { DigestService } from "./digest.service"

@Module({
  imports: [AttentionModule, CareRequestsModule, NotificationsModule],
  controllers: [DigestController],
  providers: [DigestService, DigestRepository, DigestScheduler],
})
export class DigestModule {}
