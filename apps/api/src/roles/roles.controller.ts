import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from "@nestjs/common"
import { createZodDto } from "nestjs-zod"
import { roleCreateSchema, roleUpdateSchema, type RoleResponse } from "@gembala/shared"
import { ApiConflictResponse, ApiCreatedResponse, ApiForbiddenResponse, ApiNoContentResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger"
import { RoleResponseDto } from "../swagger/response-dtos"
import { CurrentAuth, RequirePermission, RequireSystemAdmin } from "../authz/decorators"
import type { AuthContext } from "../authz/auth-context"
import { RolesService } from "./roles.service"

class RoleCreateDto extends createZodDto(roleCreateSchema) {}
class RoleUpdateDto extends createZodDto(roleUpdateSchema) {}

@ApiTags("Roles")
@Controller("roles")
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @ApiOperation({ summary: "List all roles in the organization" })
  @ApiOkResponse({ type: [RoleResponseDto] })
  @RequireSystemAdmin()
  @Get()
  list(@CurrentAuth() auth: AuthContext): Promise<RoleResponse[]> {
    return this.roles.list(auth.orgId)
  }

  // Not system-admin-only: a non-admin inviter needs this to build an
  // invite, but only ever sees roles they're allowed to grant.
  @ApiOperation({ summary: "List roles the caller is allowed to grant when inviting" })
  @ApiOkResponse({ type: [RoleResponseDto] })
  @RequirePermission("invites", "create")
  @Get("assignable")
  assignable(@CurrentAuth() auth: AuthContext): Promise<RoleResponse[]> {
    return this.roles.assignableRoles(auth)
  }

  @ApiOperation({ summary: "Create a role" })
  @ApiCreatedResponse({ type: RoleResponseDto })
  @ApiConflictResponse({ description: "A role with this name already exists" })
  @RequireSystemAdmin()
  @Post()
  create(@CurrentAuth() auth: AuthContext, @Body() dto: RoleCreateDto): Promise<RoleResponse> {
    return this.roles.create(auth.orgId, dto)
  }

  @ApiOperation({ summary: "Update a role's name, description or permissions" })
  @ApiOkResponse({ type: RoleResponseDto })
  @ApiNotFoundResponse({ description: "Role not found" })
  @ApiForbiddenResponse({ description: "The Admin role can't be edited" })
  @RequireSystemAdmin()
  @Patch(":id")
  update(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: RoleUpdateDto,
  ): Promise<RoleResponse> {
    return this.roles.update(auth.orgId, id, dto)
  }

  @ApiOperation({ summary: "Delete a role" })
  @ApiNoContentResponse({ description: "Deleted" })
  @ApiNotFoundResponse({ description: "Role not found" })
  @ApiForbiddenResponse({ description: "The Admin role can't be deleted" })
  @RequireSystemAdmin()
  @HttpCode(204)
  @Delete(":id")
  async remove(@CurrentAuth() auth: AuthContext, @Param("id", ParseUUIDPipe) id: string): Promise<void> {
    await this.roles.remove(auth.orgId, id)
  }
}
