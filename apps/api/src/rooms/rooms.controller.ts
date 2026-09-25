import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from "@nestjs/common"
import { createZodDto } from "nestjs-zod"
import { roomCreateSchema, roomUpdateSchema, type RoomResponse } from "@gembala/shared"
import { CurrentAuth, Roles } from "../authz/decorators"
import type { AuthContext } from "../authz/auth-context"
import { RoomsService } from "./rooms.service"

class RoomCreateDto extends createZodDto(roomCreateSchema) {}
class RoomUpdateDto extends createZodDto(roomUpdateSchema) {}

@Controller("rooms")
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Get()
  list(@CurrentAuth() auth: AuthContext): Promise<RoomResponse[]> {
    return this.rooms.list(auth.orgId)
  }

  @Get(":id")
  detail(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<RoomResponse> {
    return this.rooms.detail(auth.orgId, id)
  }

  @Roles("admin")
  @Post()
  create(@CurrentAuth() auth: AuthContext, @Body() dto: RoomCreateDto): Promise<RoomResponse> {
    return this.rooms.create(auth.orgId, dto)
  }

  @Roles("admin")
  @Patch(":id")
  update(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: RoomUpdateDto,
  ): Promise<RoomResponse> {
    return this.rooms.update(auth.orgId, id, dto)
  }

  @Roles("admin")
  @HttpCode(204)
  @Delete(":id")
  async remove(@CurrentAuth() auth: AuthContext, @Param("id", ParseUUIDPipe) id: string): Promise<void> {
    await this.rooms.remove(auth.orgId, id)
  }
}
