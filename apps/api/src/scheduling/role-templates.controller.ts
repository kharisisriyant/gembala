import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from "@nestjs/common"
import { createZodDto } from "nestjs-zod"
import {
  roleTemplateCreateSchema,
  roleTemplateUpdateSchema,
  type RoleTemplateResponse,
} from "@gembala/shared"
import { CurrentAuth, RequirePermission } from "../authz/decorators"
import type { AuthContext } from "../authz/auth-context"
import { RoleTemplatesService } from "./role-templates.service"

class RoleTemplateCreateDto extends createZodDto(roleTemplateCreateSchema) {}
class RoleTemplateUpdateDto extends createZodDto(roleTemplateUpdateSchema) {}

@Controller("scheduling/role-templates")
export class RoleTemplatesController {
  constructor(private readonly roleTemplates: RoleTemplatesService) {}

  @RequirePermission("scheduling", "read")
  @Get()
  list(@CurrentAuth() auth: AuthContext): Promise<RoleTemplateResponse[]> {
    return this.roleTemplates.list(auth.orgId)
  }

  @RequirePermission("scheduling", "create")
  @Post()
  create(
    @CurrentAuth() auth: AuthContext,
    @Body() dto: RoleTemplateCreateDto,
  ): Promise<RoleTemplateResponse> {
    return this.roleTemplates.create(auth.orgId, dto)
  }

  @RequirePermission("scheduling", "update")
  @Patch(":id")
  update(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: RoleTemplateUpdateDto,
  ): Promise<RoleTemplateResponse> {
    return this.roleTemplates.update(auth.orgId, id, dto)
  }

  @RequirePermission("scheduling", "delete")
  @HttpCode(204)
  @Delete(":id")
  async remove(@CurrentAuth() auth: AuthContext, @Param("id", ParseUUIDPipe) id: string): Promise<void> {
    await this.roleTemplates.remove(auth.orgId, id)
  }
}
