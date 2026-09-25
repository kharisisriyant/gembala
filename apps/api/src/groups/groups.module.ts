import { Module } from "@nestjs/common"
import { MembersModule } from "../members/members.module"
import { TagsModule } from "../tags/tags.module"
import { AttendanceService } from "./attendance.service"
import { AttendanceRepository } from "./attendance.repository"
import { GroupsController } from "./groups.controller"
import { GroupsService } from "./groups.service"
import { GroupsRepository } from "./groups.repository"

@Module({
  imports: [TagsModule, MembersModule],
  controllers: [GroupsController],
  providers: [GroupsService, GroupsRepository, AttendanceService, AttendanceRepository],
  exports: [GroupsService, AttendanceService],
})
export class GroupsModule {}
