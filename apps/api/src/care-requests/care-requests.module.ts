import { Module } from "@nestjs/common"
import { NotificationsModule } from "../notifications/notifications.module"
import { CareRequestsController } from "./care-requests.controller"
import { CareRequestsService } from "./care-requests.service"
import { CareRequestsRepository } from "./care-requests.repository"

@Module({
  imports: [NotificationsModule],
  controllers: [CareRequestsController],
  providers: [CareRequestsService, CareRequestsRepository],
  exports: [CareRequestsService],
})
export class CareRequestsModule {}
