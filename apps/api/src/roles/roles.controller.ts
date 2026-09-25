import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from "@nestjs/common"
import { createZodDto } from "nestjs-zod"
import { roleCreateSchema, roleUpdateSchema, type RoleResponse } from "@gembala/shared"
import { CurrentAuth, RequirePermission, RequireSystemAdmin } from "../authz/decorators"
import type { AuthContext } from "../authz/auth-context"
import { RolesService } from "./roles.service"

class RoleCreateDto extends createZodDto(roleCreateSchema) {}
class RoleUpdateDto extends createZodDto(roleUpdateSchema) {}

@Controller("roles")
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @RequireSystemAdmin()
  @Get()
  list(@CurrentAuth() auth: AuthContext): Promise<RoleResponse[]> {
    return this.roles.list(auth.orgId)
  }

  // Not system-admin-only: a non-admin inviter needs this to build an
  // invite, but only ever sees roles they're allowed to grant.
  @RequirePermission("invites", "create")
  @Get("assignable")
  assignable(@CurrentAuth() auth: AuthContext): Promise<RoleResponse[]> {
    return this.roles.assignableRoles(auth)
  }

  @RequireSystemAdmin()
  @Post()
  create(@CurrentAuth() auth: AuthContext, @Body() dto: RoleCreateDto): Promise<RoleResponse> {
    return this.roles.create(auth.orgId, dto)
  }

  @RequireSystemAdmin()
  @Patch(":id")
  update(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: RoleUpdateDto,
  ): Promise<RoleResponse> {
    return this.roles.update(auth.orgId, id, dto)
  }

  @RequireSystemAdmin()
  @HttpCode(204)
  @Delete(":id")
  async remove(@CurrentAuth() auth: AuthContext, @Param("id", ParseUUIDPipe) id: string): Promise<void> {
    await this.roles.remove(auth.orgId, id)
  }
}
