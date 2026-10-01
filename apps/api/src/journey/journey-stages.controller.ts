import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from "@nestjs/common"
import { ApiConflictResponse, ApiCreatedResponse, ApiNoContentResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger"
import { createZodDto } from "nestjs-zod"
import { journeyStageCreateSchema, journeyStageUpdateSchema, type JourneyStageResponse } from "@gembala/shared"
import { CurrentAuth, RequirePermission, RequireSystemAdmin } from "../authz/decorators"
import type { AuthContext } from "../authz/auth-context"
import { JourneyStageResponseDto } from "../swagger/response-dtos"
import { JourneyStagesService } from "./journey-stages.service"

class JourneyStageCreateDto extends createZodDto(journeyStageCreateSchema) {}
class JourneyStageUpdateDto extends createZodDto(journeyStageUpdateSchema) {}

@ApiTags("Journey stages")
@Controller("journey/stages")
export class JourneyStagesController {
  constructor(private readonly stages: JourneyStagesService) {}

  @ApiOperation({ summary: "List this organization's spiritual journey stages" })
  @ApiOkResponse({ type: [JourneyStageResponseDto] })
  @RequirePermission("journey", "read")
  @Get()
  list(@CurrentAuth() auth: AuthContext): Promise<JourneyStageResponse[]> { return this.stages.list(auth) }

  @ApiOperation({ summary: "Create a configurable journey stage and reminder rule" })
  @ApiCreatedResponse({ type: JourneyStageResponseDto })
  @ApiConflictResponse({ description: "A stage with this name already exists" })
  @RequireSystemAdmin()
  @Post()
  create(@CurrentAuth() auth: AuthContext, @Body() dto: JourneyStageCreateDto): Promise<JourneyStageResponse> { return this.stages.create(auth, dto) }

  @ApiOperation({ summary: "Update a journey stage or its reminder rule" })
  @ApiOkResponse({ type: JourneyStageResponseDto })
  @ApiNotFoundResponse({ description: "Journey stage not found" })
  @ApiConflictResponse({ description: "Invalid stage rule or duplicate stage name" })
  @RequireSystemAdmin()
  @Patch(":id")
  update(@CurrentAuth() auth: AuthContext, @Param("id", ParseUUIDPipe) id: string, @Body() dto: JourneyStageUpdateDto): Promise<JourneyStageResponse> { return this.stages.update(auth, id, dto) }

  @ApiOperation({ summary: "Delete a journey stage and its manual assignments" })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: "Journey stage not found" })
  @RequireSystemAdmin()
  @HttpCode(204)
  @Delete(":id")
  remove(@CurrentAuth() auth: AuthContext, @Param("id", ParseUUIDPipe) id: string): Promise<void> { return this.stages.remove(auth, id) }
}
