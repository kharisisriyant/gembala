import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Put } from "@nestjs/common"
import { createZodDto } from "nestjs-zod"
import { membershipRoleAssignSchema, type TeamMemberResponse } from "@gembala/shared"
import { ApiConflictResponse, ApiForbiddenResponse, ApiNoContentResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger"
import { TeamMemberResponseDto } from "../swagger/response-dtos"
import { CurrentAuth, RequireSystemAdmin } from "../authz/decorators"
import type { AuthContext } from "../authz/auth-context"
import { RolesService } from "./roles.service"

class MembershipRoleAssignDto extends createZodDto(membershipRoleAssignSchema) {}

@ApiTags("Team")
@Controller("team")
@RequireSystemAdmin()
export class TeamController {
  constructor(private readonly roles: RolesService) {}

  @ApiOperation({ summary: "List team members with their roles and tag scope" })
  @ApiOkResponse({ type: [TeamMemberResponseDto] })
  @Get()
  list(@CurrentAuth() auth: AuthContext): Promise<TeamMemberResponse[]> {
    return this.roles.team(auth.orgId)
  }

  @ApiOperation({ summary: "Replace the roles assigned to a team member" })
  @ApiNoContentResponse({ description: "Roles updated" })
  @ApiNotFoundResponse({ description: "Team member not found" })
  @ApiForbiddenResponse({ description: "Caller cannot grant one of the requested roles" })
  @ApiConflictResponse({ description: "An organization must keep at least one Admin" })
  @HttpCode(204)
  @Put(":membershipId/roles")
  async assignRoles(
    @CurrentAuth() auth: AuthContext,
    @Param("membershipId", ParseUUIDPipe) membershipId: string,
    @Body() dto: MembershipRoleAssignDto,
  ): Promise<void> {
    await this.roles.assignRoles(auth, membershipId, dto.roleIds)
  }
}
