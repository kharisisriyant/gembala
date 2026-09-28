import { Body, Controller, Delete, HttpCode, Param, ParseUUIDPipe, Patch, Post } from "@nestjs/common"
import { createZodDto } from "nestjs-zod"
import { roleAssignmentCreateSchema, type RoleAssignmentResponse } from "@gembala/shared"
import { ApiConflictResponse, ApiCreatedResponse, ApiNoContentResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger"
import { RoleAssignmentResponseDto } from "../swagger/response-dtos"
import { CurrentAuth, RequirePermission } from "../authz/decorators"
import type { AuthContext } from "../authz/auth-context"
import { RoleAssignmentsService } from "./role-assignments.service"

class RoleAssignmentCreateDto extends createZodDto(roleAssignmentCreateSchema) {}

@ApiTags("Scheduling")
@Controller("scheduling")
export class RoleAssignmentsController {
  constructor(private readonly roleAssignments: RoleAssignmentsService) {}

  @ApiOperation({ summary: "Assign a member (or free-text name) to a role in a service instance" })
  @ApiCreatedResponse({ type: RoleAssignmentResponseDto })
  @ApiNotFoundResponse({ description: "Service instance, role template or member not found" })
  @ApiConflictResponse({ description: "Role is not active" })
  @RequirePermission("scheduling", "create")
  @Post("instances/:instanceId/assignments")
  create(
    @CurrentAuth() auth: AuthContext,
    @Param("instanceId", ParseUUIDPipe) instanceId: string,
    @Body() dto: RoleAssignmentCreateDto,
  ): Promise<RoleAssignmentResponse> {
    return this.roleAssignments.create(auth.orgId, instanceId, dto)
  }

  @ApiOperation({ summary: "Replace a role assignment" })
  @ApiOkResponse({ type: RoleAssignmentResponseDto })
  @ApiNotFoundResponse({ description: "Assignment, role template or member not found" })
  @ApiConflictResponse({ description: "Role is not active" })
  @RequirePermission("scheduling", "update")
  @Patch("assignments/:assignmentId")
  update(
    @CurrentAuth() auth: AuthContext,
    @Param("assignmentId", ParseUUIDPipe) assignmentId: string,
    @Body() dto: RoleAssignmentCreateDto,
  ): Promise<RoleAssignmentResponse> {
    return this.roleAssignments.update(auth.orgId, assignmentId, dto)
  }

  @ApiOperation({ summary: "Remove a role assignment" })
  @ApiNoContentResponse({ description: "Deleted" })
  @ApiNotFoundResponse({ description: "Role assignment not found" })
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
