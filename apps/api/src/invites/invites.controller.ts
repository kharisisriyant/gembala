import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post } from "@nestjs/common"
import { createZodDto } from "nestjs-zod"
import {
  inviteCreateSchema,
  type InvitePreviewResponse,
  type InviteResponse,
} from "@gembala/shared"
import { CurrentAuth, Public, RequirePermission } from "../authz/decorators"
import type { AuthContext } from "../authz/auth-context"
import { InvitesService } from "./invites.service"

class InviteCreateDto extends createZodDto(inviteCreateSchema) {}

@Controller("invites")
export class InvitesController {
  constructor(private readonly invites: InvitesService) {}

  @RequirePermission("invites", "read")
  @Get()
  list(@CurrentAuth() auth: AuthContext): Promise<InviteResponse[]> {
    return this.invites.list(auth)
  }

  @RequirePermission("invites", "create")
  @Post()
  create(@CurrentAuth() auth: AuthContext, @Body() dto: InviteCreateDto): Promise<InviteResponse> {
    return this.invites.create(auth, dto)
  }

  @RequirePermission("invites", "delete")
  @HttpCode(204)
  @Delete(":id")
  async revoke(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.invites.revoke(auth, id)
  }

  @Public()
  @Get("token/:token")
  preview(@Param("token") token: string): Promise<InvitePreviewResponse> {
    return this.invites.preview(token)
  }
}
