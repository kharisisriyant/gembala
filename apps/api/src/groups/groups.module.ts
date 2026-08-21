import { Module } from "@nestjs/common"
import { MembersModule } from "../members/members.module"
import { TagsModule } from "../tags/tags.module"
import { AttendanceService } from "./attendance.service"
import { GroupsController } from "./groups.controller"
import { GroupsService } from "./groups.service"

@Module({
  imports: [TagsModule, MembersModule],
  controllers: [GroupsController],
  providers: [GroupsService, AttendanceService],
  exports: [GroupsService, AttendanceService],
})
export class GroupsModule {}
