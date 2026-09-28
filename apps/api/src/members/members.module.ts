import { Module } from "@nestjs/common"
import { TagsModule } from "../tags/tags.module"
import { MembersController } from "./members.controller"
import { MembersService } from "./members.service"
import { MembersRepository } from "./members.repository"
import { MemberRelationshipsService } from "./member-relationships.service"
import { MemberRelationshipsRepository } from "./member-relationships.repository"

@Module({
  imports: [TagsModule],
  controllers: [MembersController],
  providers: [MembersService, MembersRepository, MemberRelationshipsService, MemberRelationshipsRepository],
  exports: [MembersService, MembersRepository],
})
export class MembersModule {}
