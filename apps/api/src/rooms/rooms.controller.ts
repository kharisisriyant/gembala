import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from "@nestjs/common"
import { createZodDto } from "nestjs-zod"
import { roomCreateSchema, roomUpdateSchema, type RoomResponse } from "@gembala/shared"
import { ApiCreatedResponse, ApiNoContentResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger"
import { RoomResponseDto } from "../swagger/response-dtos"
import { CurrentAuth, RequirePermission } from "../authz/decorators"
import type { AuthContext } from "../authz/auth-context"
import { RoomsService } from "./rooms.service"

class RoomCreateDto extends createZodDto(roomCreateSchema) {}
class RoomUpdateDto extends createZodDto(roomUpdateSchema) {}

@ApiTags("Rooms")
@Controller("rooms")
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @ApiOperation({ summary: "List rooms" })
  @ApiOkResponse({ type: [RoomResponseDto] })
  @RequirePermission("rooms", "read")
  @Get()
  list(@CurrentAuth() auth: AuthContext): Promise<RoomResponse[]> {
    return this.rooms.list(auth.orgId)
  }

  @ApiOperation({ summary: "Get a room" })
  @ApiOkResponse({ type: RoomResponseDto })
  @ApiNotFoundResponse({ description: "Room not found" })
  @RequirePermission("rooms", "read")
  @Get(":id")
  detail(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<RoomResponse> {
    return this.rooms.detail(auth.orgId, id)
  }

  @ApiOperation({ summary: "Create a room" })
  @ApiCreatedResponse({ type: RoomResponseDto })
  @RequirePermission("rooms", "create")
  @Post()
  create(@CurrentAuth() auth: AuthContext, @Body() dto: RoomCreateDto): Promise<RoomResponse> {
    return this.rooms.create(auth.orgId, dto)
  }

  @ApiOperation({ summary: "Update a room" })
  @ApiOkResponse({ type: RoomResponseDto })
  @ApiNotFoundResponse({ description: "Room not found" })
  @RequirePermission("rooms", "update")
  @Patch(":id")
  update(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: RoomUpdateDto,
  ): Promise<RoomResponse> {
    return this.rooms.update(auth.orgId, id, dto)
  }

  @ApiOperation({ summary: "Delete a room" })
  @ApiNoContentResponse({ description: "Deleted" })
  @ApiNotFoundResponse({ description: "Room not found" })
  @RequirePermission("rooms", "delete")
  @HttpCode(204)
  @Delete(":id")
  async remove(@CurrentAuth() auth: AuthContext, @Param("id", ParseUUIDPipe) id: string): Promise<void> {
    await this.rooms.remove(auth.orgId, id)
  }
}
