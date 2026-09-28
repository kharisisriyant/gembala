import { Module } from "@nestjs/common"
import { CareRequestsController } from "./care-requests.controller"
import { CareRequestsService } from "./care-requests.service"
import { CareRequestsRepository } from "./care-requests.repository"

@Module({
  controllers: [CareRequestsController],
  providers: [CareRequestsService, CareRequestsRepository],
})
export class CareRequestsModule {}
