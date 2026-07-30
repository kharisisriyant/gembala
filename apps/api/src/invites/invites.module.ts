import { Module } from "@nestjs/common"
import { TagsModule } from "../tags/tags.module"
import { InvitesController } from "./invites.controller"
import { InvitesService } from "./invites.service"

@Module({
  imports: [TagsModule],
  controllers: [InvitesController],
  providers: [InvitesService],
})
export class InvitesModule {}
