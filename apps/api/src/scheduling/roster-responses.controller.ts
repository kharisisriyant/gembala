import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req } from "@nestjs/common"
import {
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
} from "@nestjs/swagger"
import type { Request } from "express"
import { z } from "zod"
import { createZodDto } from "nestjs-zod"
import {
  rosterNotifySchema,
  rosterRespondSchema,
  type RosterAssignmentPublicResponse,
  type RosterLinkResponse,
  type RosterNotifyResponse,
} from "@gembala/shared"
import { CurrentAuth, Public, RequirePermission } from "../authz/decorators"
import type { AuthContext } from "../authz/auth-context"
import {
  RosterAssignmentPublicResponseDto,
  RosterLinkResponseDto,
  RosterNotifyResponseDto,
} from "../swagger/response-dtos"
import { RosterResponsesService } from "./roster-responses.service"

class RosterNotifyDto extends createZodDto(rosterNotifySchema) {}
class RosterRespondDto extends createZodDto(rosterRespondSchema) {}
class TokenQueryDto extends createZodDto(z.object({ token: z.string().min(1).max(200) })) {}

@ApiTags("Scheduling")
@Controller()
export class RosterResponsesController {
  constructor(private readonly roster: RosterResponsesService) {}

  @ApiOperation({ summary: "Get the public confirm/decline link for a member's role assignment" })
  @ApiOkResponse({ type: RosterLinkResponseDto })
  @ApiNotFoundResponse({ description: "Role assignment not found" })
  @ApiConflictResponse({ description: "Assignment is free text, not a member" })
  @RequirePermission("scheduling", "update")
  @HttpCode(200)
  @Post("scheduling/assignments/:assignmentId/link")
  link(
    @CurrentAuth() auth: AuthContext,
    @Param("assignmentId", ParseUUIDPipe) assignmentId: string,
  ): Promise<RosterLinkResponse> {
    return this.roster.link(auth, assignmentId)
  }

  @ApiOperation({ summary: "Email the confirm/decline link to the assigned member, or return it when they have no email" })
  @ApiOkResponse({ type: RosterNotifyResponseDto })
  @ApiNotFoundResponse({ description: "Role assignment not found" })
  @ApiConflictResponse({ description: "Assignment is free text, or the service has already started" })
  @ApiServiceUnavailableResponse({ description: "The email could not be sent" })
  @RequirePermission("scheduling", "update")
  @HttpCode(200)
  @Post("scheduling/assignments/:assignmentId/notify")
  notify(
    @CurrentAuth() auth: AuthContext,
    @Param("assignmentId", ParseUUIDPipe) assignmentId: string,
    @Body() dto: RosterNotifyDto,
  ): Promise<RosterNotifyResponse> {
    return this.roster.notify(auth, assignmentId, dto)
  }

  @ApiOperation({ summary: "Show a roster assignment from its signed link (no login)" })
  @ApiQuery({ name: "token", description: "Signed token from the confirm/decline link" })
  @ApiOkResponse({ type: RosterAssignmentPublicResponseDto })
  @ApiNotFoundResponse({ description: "Invalid, tampered or no longer valid link" })
  @ApiTooManyRequestsResponse({ description: "Too many requests from this address" })
  @Public()
  @Get("roster-response")
  view(@Query() query: TokenQueryDto, @Req() req: Request): Promise<RosterAssignmentPublicResponse> {
    return this.roster.view(query.token, req.ip)
  }

  @ApiOperation({ summary: "Confirm or decline a roster assignment from its signed link (no login)" })
  @ApiQuery({ name: "token", description: "Signed token from the confirm/decline link" })
  @ApiOkResponse({ type: RosterAssignmentPublicResponseDto })
  @ApiNotFoundResponse({ description: "Invalid, tampered or no longer valid link" })
  @ApiConflictResponse({ description: "The service has already started; answers are closed" })
  @ApiTooManyRequestsResponse({ description: "Too many requests from this address" })
  @Public()
  @HttpCode(200)
  @Post("roster-response")
  respond(
    @Query() query: TokenQueryDto,
    @Body() dto: RosterRespondDto,
    @Req() req: Request,
  ): Promise<RosterAssignmentPublicResponse> {
    return this.roster.respond(query.token, dto, req.ip)
  }
}
