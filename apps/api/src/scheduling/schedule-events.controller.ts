import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from "@nestjs/common"
import { createZodDto } from "nestjs-zod"
import {
  scheduleEventCreateSchema,
  scheduleEventUpdateSchema,
  type ScheduleEventDetailResponse,
} from "@gembala/shared"
import { ApiCreatedResponse, ApiNoContentResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger"
import { ScheduleEventDetailResponseDto } from "../swagger/response-dtos"
import { CurrentAuth, RequirePermission } from "../authz/decorators"
import type { AuthContext } from "../authz/auth-context"
import { ScheduleEventsService } from "./schedule-events.service"

class ScheduleEventCreateDto extends createZodDto(scheduleEventCreateSchema) {}
class ScheduleEventUpdateDto extends createZodDto(scheduleEventUpdateSchema) {}

@ApiTags("Scheduling")
@Controller("scheduling/events")
export class ScheduleEventsController {
  constructor(private readonly scheduleEvents: ScheduleEventsService) {}

  @ApiOperation({ summary: "List service schedule events with their instances and role assignments" })
  @ApiOkResponse({ type: [ScheduleEventDetailResponseDto] })
  @RequirePermission("scheduling", "read")
  @Get()
  list(@CurrentAuth() auth: AuthContext): Promise<ScheduleEventDetailResponse[]> {
    return this.scheduleEvents.list(auth.orgId)
  }

  @ApiOperation({ summary: "Get a schedule event with its instances and assignments" })
  @ApiOkResponse({ type: ScheduleEventDetailResponseDto })
  @ApiNotFoundResponse({ description: "Schedule event not found" })
  @RequirePermission("scheduling", "read")
  @Get(":id")
  detail(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<ScheduleEventDetailResponse> {
    return this.scheduleEvents.detail(auth.orgId, id)
  }

  @ApiOperation({ summary: "Create a schedule event (a service date)" })
  @ApiCreatedResponse({ type: ScheduleEventDetailResponseDto })
  @RequirePermission("scheduling", "create")
  @Post()
  create(
    @CurrentAuth() auth: AuthContext,
    @Body() dto: ScheduleEventCreateDto,
  ): Promise<ScheduleEventDetailResponse> {
    return this.scheduleEvents.create(auth.orgId, dto)
  }

  @ApiOperation({ summary: "Update a schedule event" })
  @ApiOkResponse({ type: ScheduleEventDetailResponseDto })
  @ApiNotFoundResponse({ description: "Schedule event not found" })
  @RequirePermission("scheduling", "update")
  @Patch(":id")
  update(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ScheduleEventUpdateDto,
  ): Promise<ScheduleEventDetailResponse> {
    return this.scheduleEvents.update(auth.orgId, id, dto)
  }

  @ApiOperation({ summary: "Delete a schedule event" })
  @ApiNoContentResponse({ description: "Deleted" })
  @ApiNotFoundResponse({ description: "Schedule event not found" })
  @RequirePermission("scheduling", "delete")
  @HttpCode(204)
  @Delete(":id")
  async remove(@CurrentAuth() auth: AuthContext, @Param("id", ParseUUIDPipe) id: string): Promise<void> {
    await this.scheduleEvents.remove(auth.orgId, id)
  }
}
