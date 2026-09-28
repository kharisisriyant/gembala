import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post } from "@nestjs/common"
import { createZodDto } from "nestjs-zod"
import {
  inviteCreateSchema,
  type InvitePreviewResponse,
  type InviteResponse,
} from "@gembala/shared"
import { ApiCreatedResponse, ApiForbiddenResponse, ApiNoContentResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger"
import { InvitePreviewResponseDto, InviteResponseDto } from "../swagger/response-dtos"
import { CurrentAuth, Public, RequirePermission } from "../authz/decorators"
import type { AuthContext } from "../authz/auth-context"
import { InvitesService } from "./invites.service"

class InviteCreateDto extends createZodDto(inviteCreateSchema) {}

@ApiTags("Invites")
@Controller("invites")
export class InvitesController {
  constructor(private readonly invites: InvitesService) {}

  @ApiOperation({ summary: "List invites visible to the caller" })
  @ApiOkResponse({ type: [InviteResponseDto] })
  @RequirePermission("invites", "read")
  @Get()
  list(@CurrentAuth() auth: AuthContext): Promise<InviteResponse[]> {
    return this.invites.list(auth)
  }

  @ApiOperation({ summary: "Invite someone by email with roles and tag scope" })
  @ApiCreatedResponse({ type: InviteResponseDto })
  @ApiForbiddenResponse({ description: "Caller cannot grant one of the requested roles" })
  @RequirePermission("invites", "create")
  @Post()
  create(@CurrentAuth() auth: AuthContext, @Body() dto: InviteCreateDto): Promise<InviteResponse> {
    return this.invites.create(auth, dto)
  }

  @ApiOperation({ summary: "Revoke a pending invite" })
  @ApiNoContentResponse({ description: "Revoked" })
  @ApiNotFoundResponse({ description: "Invite not found" })
  @RequirePermission("invites", "delete")
  @HttpCode(204)
  @Delete(":id")
  async revoke(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.invites.revoke(auth, id)
  }

  @ApiOperation({ summary: "Preview an invite by its token (used by the accept-invite page)" })
  @ApiOkResponse({ type: InvitePreviewResponseDto })
  @ApiNotFoundResponse({ description: "Invalid or expired invite" })
  @Public()
  @Get("token/:token")
  preview(@Param("token") token: string): Promise<InvitePreviewResponse> {
    return this.invites.preview(token)
  }
}
