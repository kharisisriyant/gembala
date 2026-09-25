import { Module } from "@nestjs/common"
import { TagsModule } from "../tags/tags.module"
import { MembersController } from "./members.controller"
import { MembersService } from "./members.service"
import { MemberRelationshipsService } from "./member-relationships.service"

@Module({
  imports: [TagsModule],
  controllers: [MembersController],
  providers: [MembersService, MemberRelationshipsService],
  exports: [MembersService],
})
export class MembersModule {}
