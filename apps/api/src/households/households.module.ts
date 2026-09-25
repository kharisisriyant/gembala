import { Module } from "@nestjs/common"
import { MembersModule } from "../members/members.module"
import { HouseholdsController } from "./households.controller"
import { HouseholdsService } from "./households.service"

@Module({
  imports: [MembersModule],
  controllers: [HouseholdsController],
  providers: [HouseholdsService],
  exports: [HouseholdsService],
})
export class HouseholdsModule {}
