import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from "@nestjs/common"
import { createZodDto } from "nestjs-zod"
import {
  groupCreateSchema,
  groupUpdateSchema,
  sessionCreateSchema,
  type AttendanceHeatmapResponse,
  type GroupDetailResponse,
  type GroupSummaryResponse,
  type SessionResponse,
} from "@gembala/shared"
import { CurrentAuth } from "../authz/decorators"
import type { AuthContext } from "../authz/auth-context"
import { GroupsService } from "./groups.service"
import { AttendanceService } from "./attendance.service"

class GroupCreateDto extends createZodDto(groupCreateSchema) {}
class GroupUpdateDto extends createZodDto(groupUpdateSchema) {}
class SessionCreateDto extends createZodDto(sessionCreateSchema) {}

@Controller("groups")
export class GroupsController {
  constructor(
    private readonly groups: GroupsService,
    private readonly attendance: AttendanceService,
  ) {}

  @Get()
  list(@CurrentAuth() auth: AuthContext): Promise<GroupSummaryResponse[]> {
    return this.groups.list(auth)
  }

  @Post()
  create(@CurrentAuth() auth: AuthContext, @Body() dto: GroupCreateDto): Promise<GroupSummaryResponse> {
    return this.groups.create(auth, dto)
  }

  @Get("attendance-heatmap")
  attendanceHeatmap(@CurrentAuth() auth: AuthContext): Promise<AttendanceHeatmapResponse> {
    return this.groups.attendanceHeatmap(auth)
  }

  @Get(":id")
  detail(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<GroupDetailResponse> {
    return this.groups.detail(auth, id)
  }

  @Patch(":id")
  update(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: GroupUpdateDto,
  ): Promise<GroupSummaryResponse> {
    return this.groups.update(auth, id, dto)
  }

  @Post(":id/sessions")
  logSession(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: SessionCreateDto,
  ): Promise<SessionResponse> {
    return this.attendance.logSession(auth, id, dto)
  }
}
