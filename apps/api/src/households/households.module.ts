import { Module } from "@nestjs/common"
import { MembersModule } from "../members/members.module"
import { HouseholdsController } from "./households.controller"
import { HouseholdsService } from "./households.service"
import { HouseholdsRepository } from "./households.repository"

@Module({
  imports: [MembersModule],
  controllers: [HouseholdsController],
  providers: [HouseholdsService, HouseholdsRepository],
  exports: [HouseholdsService],
})
export class HouseholdsModule {}
