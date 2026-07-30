import { Module } from "@nestjs/common"
import { GroupsModule } from "../groups/groups.module"
import { MembersModule } from "../members/members.module"
import { DashboardController } from "./dashboard.controller"
import { DashboardService } from "./dashboard.service"

@Module({
  imports: [MembersModule, GroupsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
