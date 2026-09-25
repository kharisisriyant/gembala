import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from "@nestjs/common"
import { createZodDto } from "nestjs-zod"
import { roomCreateSchema, roomUpdateSchema, type RoomResponse } from "@gembala/shared"
import { CurrentAuth, RequirePermission } from "../authz/decorators"
import type { AuthContext } from "../authz/auth-context"
import { RoomsService } from "./rooms.service"

class RoomCreateDto extends createZodDto(roomCreateSchema) {}
class RoomUpdateDto extends createZodDto(roomUpdateSchema) {}

@Controller("rooms")
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @RequirePermission("rooms", "read")
  @Get()
  list(@CurrentAuth() auth: AuthContext): Promise<RoomResponse[]> {
    return this.rooms.list(auth.orgId)
  }

  @RequirePermission("rooms", "read")
  @Get(":id")
  detail(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<RoomResponse> {
    return this.rooms.detail(auth.orgId, id)
  }

  @RequirePermission("rooms", "create")
  @Post()
  create(@CurrentAuth() auth: AuthContext, @Body() dto: RoomCreateDto): Promise<RoomResponse> {
    return this.rooms.create(auth.orgId, dto)
  }

  @RequirePermission("rooms", "update")
  @Patch(":id")
  update(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: RoomUpdateDto,
  ): Promise<RoomResponse> {
    return this.rooms.update(auth.orgId, id, dto)
  }

  @RequirePermission("rooms", "delete")
  @HttpCode(204)
  @Delete(":id")
  async remove(@CurrentAuth() auth: AuthContext, @Param("id", ParseUUIDPipe) id: string): Promise<void> {
    await this.rooms.remove(auth.orgId, id)
  }
}
