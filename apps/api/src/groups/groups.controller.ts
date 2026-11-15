import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from "@nestjs/common"
import { createZodDto } from "nestjs-zod"
import {
  groupCreateSchema,
  groupUpdateSchema,
  sessionCreateSchema,
  sessionUpdateSchema,
  type AttendanceHeatmapResponse,
  type GroupDetailResponse,
  type GroupSummaryResponse,
  type SessionResponse,
} from "@gembala/shared"
import { ApiBadRequestResponse, ApiCreatedResponse, ApiForbiddenResponse, ApiNoContentResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger"
import { AttendanceHeatmapResponseDto, GroupDetailResponseDto, GroupSummaryResponseDto, SessionResponseDto } from "../swagger/response-dtos"
import { CurrentAuth, RequirePermission } from "../authz/decorators"
import type { AuthContext } from "../authz/auth-context"
import { GroupsService } from "./groups.service"
import { AttendanceService } from "./attendance.service"

class GroupCreateDto extends createZodDto(groupCreateSchema) {}
class GroupUpdateDto extends createZodDto(groupUpdateSchema) {}
class SessionCreateDto extends createZodDto(sessionCreateSchema) {}
class SessionUpdateDto extends createZodDto(sessionUpdateSchema) {}

@ApiTags("Groups")
@Controller("groups")
export class GroupsController {
  constructor(
    private readonly groups: GroupsService,
    private readonly attendance: AttendanceService,
  ) {}

  @ApiOperation({ summary: "List small groups in the caller's scope" })
  @ApiOkResponse({ type: [GroupSummaryResponseDto] })
  @RequirePermission("groups", "read")
  @Get()
  list(@CurrentAuth() auth: AuthContext): Promise<GroupSummaryResponse[]> {
    return this.groups.list(auth)
  }

  @ApiOperation({ summary: "Create a group" })
  @ApiCreatedResponse({ type: GroupSummaryResponseDto })
  @ApiBadRequestResponse({ description: "One or more member ids do not exist in this organization" })
  @ApiForbiddenResponse({ description: "Group scope tag is outside the caller's tag scope" })
  @RequirePermission("groups", "create")
  @Post()
  create(@CurrentAuth() auth: AuthContext, @Body() dto: GroupCreateDto): Promise<GroupSummaryResponse> {
    return this.groups.create(auth, dto)
  }

  @ApiOperation({ summary: "Weekly attendance rate per group" })
  @ApiOkResponse({ type: AttendanceHeatmapResponseDto })
  @RequirePermission("groups", "read")
  @Get("attendance-heatmap")
  attendanceHeatmap(@CurrentAuth() auth: AuthContext): Promise<AttendanceHeatmapResponse> {
    return this.groups.attendanceHeatmap(auth)
  }

  @ApiOperation({ summary: "Get a group with members, sessions and stats" })
  @ApiOkResponse({ type: GroupDetailResponseDto })
  @ApiNotFoundResponse({ description: "Group not found or outside the caller's tag scope" })
  @RequirePermission("groups", "read")
  @Get(":id")
  detail(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<GroupDetailResponse> {
    return this.groups.detail(auth, id)
  }

  @ApiOperation({ summary: "Update a group" })
  @ApiOkResponse({ type: GroupSummaryResponseDto })
  @ApiNotFoundResponse({ description: "Group not found or outside the caller's tag scope" })
  @ApiBadRequestResponse({ description: "One or more member ids do not exist in this organization" })
  @RequirePermission("groups", "update")
  @Patch(":id")
  update(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: GroupUpdateDto,
  ): Promise<GroupSummaryResponse> {
    return this.groups.update(auth, id, dto)
  }

  @ApiOperation({ summary: "Log a meeting session with attendance" })
  @ApiCreatedResponse({ type: SessionResponseDto })
  @ApiNotFoundResponse({ description: "Group not found or outside the caller's tag scope" })
  @ApiForbiddenResponse({ description: "Group is outside the caller's tag scope" })
  @ApiBadRequestResponse({
    description: "presentIds and excused must all be members of the group, and a member cannot be both present and excused",
  })
  @RequirePermission("groups", "update")
  @Post(":id/sessions")
  logSession(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: SessionCreateDto,
  ): Promise<SessionResponse> {
    return this.attendance.logSession(auth, id, dto)
  }

  @ApiOperation({ summary: "Edit a logged session and, optionally, replace its attendance" })
  @ApiOkResponse({ type: SessionResponseDto })
  @ApiNotFoundResponse({ description: "Group or session not found, or the session belongs to another group" })
  @ApiForbiddenResponse({ description: "Group is outside the caller's tag scope" })
  @ApiBadRequestResponse({
    description: "presentIds and excused must all be members of the group, and a member cannot be both present and excused",
  })
  @RequirePermission("groups", "update")
  @Patch(":id/sessions/:sessionId")
  updateSession(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("sessionId", ParseUUIDPipe) sessionId: string,
    @Body() dto: SessionUpdateDto,
  ): Promise<SessionResponse> {
    return this.attendance.updateSession(auth, id, sessionId, dto)
  }

  @ApiOperation({ summary: "Delete a logged session and its attendance" })
  @ApiNoContentResponse({ description: "Session deleted" })
  @ApiNotFoundResponse({ description: "Group or session not found, or the session belongs to another group" })
  @ApiForbiddenResponse({ description: "Group is outside the caller's tag scope" })
  @RequirePermission("groups", "update")
  @HttpCode(204)
  @Delete(":id/sessions/:sessionId")
  deleteSession(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("sessionId", ParseUUIDPipe) sessionId: string,
  ): Promise<void> {
    return this.attendance.deleteSession(auth, id, sessionId)
  }
}
