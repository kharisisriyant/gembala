import { Module } from "@nestjs/common"
import { TagsModule } from "../tags/tags.module"
import { RolesModule } from "../roles/roles.module"
import { InvitesController } from "./invites.controller"
import { InvitesService } from "./invites.service"
import { InvitesRepository } from "./invites.repository"

@Module({
  imports: [TagsModule, RolesModule],
  controllers: [InvitesController],
  providers: [InvitesService, InvitesRepository],
  exports: [InvitesRepository],
})
export class InvitesModule {}
