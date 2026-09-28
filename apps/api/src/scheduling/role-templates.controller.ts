import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from "@nestjs/common"
import { createZodDto } from "nestjs-zod"
import {
  roleTemplateCreateSchema,
  roleTemplateUpdateSchema,
  type RoleTemplateResponse,
} from "@gembala/shared"
import { ApiCreatedResponse, ApiNoContentResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger"
import { RoleTemplateResponseDto } from "../swagger/response-dtos"
import { CurrentAuth, RequirePermission } from "../authz/decorators"
import type { AuthContext } from "../authz/auth-context"
import { RoleTemplatesService } from "./role-templates.service"

class RoleTemplateCreateDto extends createZodDto(roleTemplateCreateSchema) {}
class RoleTemplateUpdateDto extends createZodDto(roleTemplateUpdateSchema) {}

@ApiTags("Scheduling")
@Controller("scheduling/role-templates")
export class RoleTemplatesController {
  constructor(private readonly roleTemplates: RoleTemplatesService) {}

  @ApiOperation({ summary: "List serving role templates (e.g. Worship Leader)" })
  @ApiOkResponse({ type: [RoleTemplateResponseDto] })
  @RequirePermission("scheduling", "read")
  @Get()
  list(@CurrentAuth() auth: AuthContext): Promise<RoleTemplateResponse[]> {
    return this.roleTemplates.list(auth.orgId)
  }

  @ApiOperation({ summary: "Create a role template" })
  @ApiCreatedResponse({ type: RoleTemplateResponseDto })
  @RequirePermission("scheduling", "create")
  @Post()
  create(
    @CurrentAuth() auth: AuthContext,
    @Body() dto: RoleTemplateCreateDto,
  ): Promise<RoleTemplateResponse> {
    return this.roleTemplates.create(auth.orgId, dto)
  }

  @ApiOperation({ summary: "Update a role template" })
  @ApiOkResponse({ type: RoleTemplateResponseDto })
  @ApiNotFoundResponse({ description: "Role template not found" })
  @RequirePermission("scheduling", "update")
  @Patch(":id")
  update(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: RoleTemplateUpdateDto,
  ): Promise<RoleTemplateResponse> {
    return this.roleTemplates.update(auth.orgId, id, dto)
  }

  @ApiOperation({ summary: "Delete a role template" })
  @ApiNoContentResponse({ description: "Deleted" })
  @ApiNotFoundResponse({ description: "Role template not found" })
  @RequirePermission("scheduling", "delete")
  @HttpCode(204)
  @Delete(":id")
  async remove(@CurrentAuth() auth: AuthContext, @Param("id", ParseUUIDPipe) id: string): Promise<void> {
    await this.roleTemplates.remove(auth.orgId, id)
  }
}
