import { Module } from "@nestjs/common"
import { RolesController } from "./roles.controller"
import { TeamController } from "./team.controller"
import { RolesService } from "./roles.service"

@Module({
  controllers: [RolesController, TeamController],
  providers: [RolesService],
  exports: [RolesService],
})
export class RolesModule {}
