import { Module } from "@nestjs/common"
import { RolesController } from "./roles.controller"
import { TeamController } from "./team.controller"
import { RolesService } from "./roles.service"
import { RolesRepository } from "./roles.repository"

@Module({
  controllers: [RolesController, TeamController],
  providers: [RolesService, RolesRepository],
  exports: [RolesService],
})
export class RolesModule {}
