import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from "@nestjs/common"
import { createZodDto } from "nestjs-zod"
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger"
import { pastoralNoteBodySchema, type PastoralNoteResponse } from "@gembala/shared"
import { PastoralNoteResponseDto } from "../swagger/response-dtos"
import { CurrentAuth, RequirePermission } from "../authz/decorators"
import type { AuthContext } from "../authz/auth-context"
import { PastoralNotesService } from "./pastoral-notes.service"

class PastoralNoteBodyDto extends createZodDto(pastoralNoteBodySchema) {}

@ApiTags("Pastoral notes")
@Controller()
export class PastoralNotesController {
  constructor(private readonly notes: PastoralNotesService) {}

  @ApiOperation({
    summary: "List private pastoral notes about a member, newest first",
    description: "Only notes the caller wrote are returned; org admins see every note.",
  })
  @ApiOkResponse({ type: [PastoralNoteResponseDto] })
  @ApiNotFoundResponse({ description: "Member not found or outside the caller's tag scope" })
  @RequirePermission("members", "read")
  @Get("members/:id/notes")
  list(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) memberId: string,
  ): Promise<PastoralNoteResponse[]> {
    return this.notes.list(auth, memberId)
  }

  @ApiOperation({ summary: "Write a private pastoral note about a member" })
  @ApiCreatedResponse({ type: PastoralNoteResponseDto })
  @ApiNotFoundResponse({ description: "Member not found or outside the caller's tag scope" })
  @ApiBadRequestResponse({ description: "Body is empty after trimming or too long" })
  @RequirePermission("members", "update")
  @Post("members/:id/notes")
  create(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) memberId: string,
    @Body() dto: PastoralNoteBodyDto,
  ): Promise<PastoralNoteResponse> {
    return this.notes.create(auth, memberId, dto.body, "web")
  }

  @ApiOperation({ summary: "Edit a pastoral note (author only)" })
  @ApiOkResponse({ type: PastoralNoteResponseDto })
  @ApiNotFoundResponse({ description: "Note not found, not visible to the caller, or its member is outside the caller's tag scope" })
  @ApiForbiddenResponse({ description: "Caller is an admin but not the author; only the author can edit" })
  @ApiBadRequestResponse({ description: "Body is empty after trimming or too long" })
  @RequirePermission("members", "update")
  @Patch("notes/:id")
  update(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: PastoralNoteBodyDto,
  ): Promise<PastoralNoteResponse> {
    return this.notes.update(auth, id, dto.body)
  }

  @ApiOperation({ summary: "Delete a pastoral note (author or org admin)" })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: "Note not found, not visible to the caller, or its member is outside the caller's tag scope" })
  @RequirePermission("members", "update")
  @HttpCode(204)
  @Delete("notes/:id")
  remove(@CurrentAuth() auth: AuthContext, @Param("id", ParseUUIDPipe) id: string): Promise<void> {
    return this.notes.remove(auth, id)
  }
}
