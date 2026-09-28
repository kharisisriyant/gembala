import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from "@nestjs/common"
import { createZodDto } from "nestjs-zod"
import { eventCreateSchema, eventUpdateSchema, type EventResponse } from "@gembala/shared"
import { ApiConflictResponse, ApiCreatedResponse, ApiNoContentResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger"
import { EventResponseDto } from "../swagger/response-dtos"
import { CurrentAuth, RequirePermission } from "../authz/decorators"
import type { AuthContext } from "../authz/auth-context"
import { EventsService } from "./events.service"

class EventCreateDto extends createZodDto(eventCreateSchema) {}
class EventUpdateDto extends createZodDto(eventUpdateSchema) {}

@ApiTags("Events")
@Controller("events")
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @ApiOperation({ summary: "List calendar events" })
  @ApiOkResponse({ type: [EventResponseDto] })
  @RequirePermission("events", "read")
  @Get()
  list(@CurrentAuth() auth: AuthContext): Promise<EventResponse[]> {
    return this.events.list(auth.orgId)
  }

  @ApiOperation({ summary: "Get an event" })
  @ApiOkResponse({ type: EventResponseDto })
  @ApiNotFoundResponse({ description: "Event not found" })
  @RequirePermission("events", "read")
  @Get(":id")
  detail(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<EventResponse> {
    return this.events.detail(auth.orgId, id)
  }

  @ApiOperation({ summary: "Create an event, optionally booking a room" })
  @ApiCreatedResponse({ type: EventResponseDto })
  @ApiNotFoundResponse({ description: "Room not found" })
  @ApiConflictResponse({ description: "Room is already booked for that time" })
  @RequirePermission("events", "create")
  @Post()
  create(@CurrentAuth() auth: AuthContext, @Body() dto: EventCreateDto): Promise<EventResponse> {
    return this.events.create(auth.orgId, dto)
  }

  @ApiOperation({ summary: "Update an event" })
  @ApiOkResponse({ type: EventResponseDto })
  @ApiNotFoundResponse({ description: "Event or room not found" })
  @ApiConflictResponse({ description: "Room is already booked, or end is not after start" })
  @RequirePermission("events", "update")
  @Patch(":id")
  update(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: EventUpdateDto,
  ): Promise<EventResponse> {
    return this.events.update(auth.orgId, id, dto)
  }

  @ApiOperation({ summary: "Delete an event" })
  @ApiNoContentResponse({ description: "Deleted" })
  @ApiNotFoundResponse({ description: "Event not found" })
  @RequirePermission("events", "delete")
  @HttpCode(204)
  @Delete(":id")
  async remove(@CurrentAuth() auth: AuthContext, @Param("id", ParseUUIDPipe) id: string): Promise<void> {
    await this.events.remove(auth.orgId, id)
  }
}
