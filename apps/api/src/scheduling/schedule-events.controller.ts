import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from "@nestjs/common"
import { createZodDto } from "nestjs-zod"
import {
  scheduleEventCreateSchema,
  scheduleEventUpdateSchema,
  type ScheduleEventDetailResponse,
} from "@gembala/shared"
import { CurrentAuth, RequirePermission } from "../authz/decorators"
import type { AuthContext } from "../authz/auth-context"
import { ScheduleEventsService } from "./schedule-events.service"

class ScheduleEventCreateDto extends createZodDto(scheduleEventCreateSchema) {}
class ScheduleEventUpdateDto extends createZodDto(scheduleEventUpdateSchema) {}

@Controller("scheduling/events")
export class ScheduleEventsController {
  constructor(private readonly scheduleEvents: ScheduleEventsService) {}

  @RequirePermission("scheduling", "read")
  @Get()
  list(@CurrentAuth() auth: AuthContext): Promise<ScheduleEventDetailResponse[]> {
    return this.scheduleEvents.list(auth.orgId)
  }

  @RequirePermission("scheduling", "read")
  @Get(":id")
  detail(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<ScheduleEventDetailResponse> {
    return this.scheduleEvents.detail(auth.orgId, id)
  }

  @RequirePermission("scheduling", "create")
  @Post()
  create(
    @CurrentAuth() auth: AuthContext,
    @Body() dto: ScheduleEventCreateDto,
  ): Promise<ScheduleEventDetailResponse> {
    return this.scheduleEvents.create(auth.orgId, dto)
  }

  @RequirePermission("scheduling", "update")
  @Patch(":id")
  update(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ScheduleEventUpdateDto,
  ): Promise<ScheduleEventDetailResponse> {
    return this.scheduleEvents.update(auth.orgId, id, dto)
  }

  @RequirePermission("scheduling", "delete")
  @HttpCode(204)
  @Delete(":id")
  async remove(@CurrentAuth() auth: AuthContext, @Param("id", ParseUUIDPipe) id: string): Promise<void> {
    await this.scheduleEvents.remove(auth.orgId, id)
  }
}
