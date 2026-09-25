import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from "@nestjs/common"
import { createZodDto } from "nestjs-zod"
import { eventCreateSchema, eventUpdateSchema, type EventResponse } from "@gembala/shared"
import { CurrentAuth, RequirePermission } from "../authz/decorators"
import type { AuthContext } from "../authz/auth-context"
import { EventsService } from "./events.service"

class EventCreateDto extends createZodDto(eventCreateSchema) {}
class EventUpdateDto extends createZodDto(eventUpdateSchema) {}

@Controller("events")
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @RequirePermission("events", "read")
  @Get()
  list(@CurrentAuth() auth: AuthContext): Promise<EventResponse[]> {
    return this.events.list(auth.orgId)
  }

  @RequirePermission("events", "read")
  @Get(":id")
  detail(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<EventResponse> {
    return this.events.detail(auth.orgId, id)
  }

  @RequirePermission("events", "create")
  @Post()
  create(@CurrentAuth() auth: AuthContext, @Body() dto: EventCreateDto): Promise<EventResponse> {
    return this.events.create(auth.orgId, dto)
  }

  @RequirePermission("events", "update")
  @Patch(":id")
  update(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: EventUpdateDto,
  ): Promise<EventResponse> {
    return this.events.update(auth.orgId, id, dto)
  }

  @RequirePermission("events", "delete")
  @HttpCode(204)
  @Delete(":id")
  async remove(@CurrentAuth() auth: AuthContext, @Param("id", ParseUUIDPipe) id: string): Promise<void> {
    await this.events.remove(auth.orgId, id)
  }
}
