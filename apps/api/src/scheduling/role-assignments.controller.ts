import { Body, Controller, Delete, HttpCode, Param, ParseUUIDPipe, Patch, Post } from "@nestjs/common"
import { createZodDto } from "nestjs-zod"
import { roleAssignmentCreateSchema, type RoleAssignmentResponse } from "@gembala/shared"
import { CurrentAuth, RequirePermission } from "../authz/decorators"
import type { AuthContext } from "../authz/auth-context"
import { RoleAssignmentsService } from "./role-assignments.service"

class RoleAssignmentCreateDto extends createZodDto(roleAssignmentCreateSchema) {}

@Controller("scheduling")
export class RoleAssignmentsController {
  constructor(private readonly roleAssignments: RoleAssignmentsService) {}

  @RequirePermission("scheduling", "create")
  @Post("instances/:instanceId/assignments")
  create(
    @CurrentAuth() auth: AuthContext,
    @Param("instanceId", ParseUUIDPipe) instanceId: string,
    @Body() dto: RoleAssignmentCreateDto,
  ): Promise<RoleAssignmentResponse> {
    return this.roleAssignments.create(auth.orgId, instanceId, dto)
  }

  @RequirePermission("scheduling", "update")
  @Patch("assignments/:assignmentId")
  update(
    @CurrentAuth() auth: AuthContext,
    @Param("assignmentId", ParseUUIDPipe) assignmentId: string,
    @Body() dto: RoleAssignmentCreateDto,
  ): Promise<RoleAssignmentResponse> {
    return this.roleAssignments.update(auth.orgId, assignmentId, dto)
  }

  @RequirePermission("scheduling", "delete")
  @HttpCode(204)
  @Delete("assignments/:assignmentId")
  async remove(
    @CurrentAuth() auth: AuthContext,
    @Param("assignmentId", ParseUUIDPipe) assignmentId: string,
  ): Promise<void> {
    await this.roleAssignments.remove(auth.orgId, assignmentId)
  }
}
