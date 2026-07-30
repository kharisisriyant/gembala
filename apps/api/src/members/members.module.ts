import { Module } from "@nestjs/common"
import { TagsModule } from "../tags/tags.module"
import { MembersController } from "./members.controller"
import { MembersService } from "./members.service"

@Module({
  imports: [TagsModule],
  controllers: [MembersController],
  providers: [MembersService],
  exports: [MembersService],
})
export class MembersModule {}
