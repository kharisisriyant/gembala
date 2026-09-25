import { Body, Controller, Get, Param, ParseUUIDPipe, Put } from "@nestjs/common"
import { createZodDto } from "nestjs-zod"
import { membershipRoleAssignSchema, type TeamMemberResponse } from "@gembala/shared"
import { CurrentAuth, RequireSystemAdmin } from "../authz/decorators"
import type { AuthContext } from "../authz/auth-context"
import { RolesService } from "./roles.service"

class MembershipRoleAssignDto extends createZodDto(membershipRoleAssignSchema) {}

@Controller("team")
@RequireSystemAdmin()
export class TeamController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  list(@CurrentAuth() auth: AuthContext): Promise<TeamMemberResponse[]> {
    return this.roles.team(auth.orgId)
  }

  @Put(":membershipId/roles")
  async assignRoles(
    @CurrentAuth() auth: AuthContext,
    @Param("membershipId", ParseUUIDPipe) membershipId: string,
    @Body() dto: MembershipRoleAssignDto,
  ): Promise<void> {
    await this.roles.assignRoles(auth, membershipId, dto.roleIds)
  }
}
