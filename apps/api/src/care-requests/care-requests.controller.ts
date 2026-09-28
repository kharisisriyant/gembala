import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common"
import { createZodDto } from "nestjs-zod"
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger"
import {
  careRequestCloseSchema,
  careRequestCreateSchema,
  careRequestStatusSchema,
  careRequestTypeSchema,
  careRequestUpdateSchema,
  type CareRequestResponse,
} from "@gembala/shared"
import { z } from "zod"
import { CareRequestResponseDto } from "../swagger/response-dtos"
import { CurrentAuth, RequirePermission } from "../authz/decorators"
import type { AuthContext } from "../authz/auth-context"
import { CareRequestsService } from "./care-requests.service"

class CareRequestCreateDto extends createZodDto(careRequestCreateSchema) {}
class CareRequestUpdateDto extends createZodDto(careRequestUpdateSchema) {}
class CareRequestCloseDto extends createZodDto(careRequestCloseSchema) {}
class CareRequestListQueryDto extends createZodDto(
  z.object({
    status: careRequestStatusSchema.optional(),
    type: careRequestTypeSchema.optional(),
    memberId: z.string().uuid().optional(),
  }),
) {}

@ApiTags("Care requests")
@Controller("care-requests")
export class CareRequestsController {
  constructor(private readonly requests: CareRequestsService) {}

  @ApiOperation({ summary: "List prayer/care requests for members in the caller's scope, newest first" })
  @ApiQuery({ name: "status", required: false, enum: ["open", "closed"] })
  @ApiQuery({ name: "type", required: false, enum: ["prayer", "care"] })
  @ApiQuery({ name: "memberId", required: false, description: "Only requests about this member" })
  @ApiOkResponse({ type: [CareRequestResponseDto] })
  @RequirePermission("care_requests", "read")
  @Get()
  list(
    @CurrentAuth() auth: AuthContext,
    @Query() query: CareRequestListQueryDto,
  ): Promise<CareRequestResponse[]> {
    return this.requests.list(auth, query)
  }

  @ApiOperation({ summary: "Get a request" })
  @ApiOkResponse({ type: CareRequestResponseDto })
  @ApiNotFoundResponse({ description: "Request not found or its member is outside the caller's tag scope" })
  @RequirePermission("care_requests", "read")
  @Get(":id")
  get(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<CareRequestResponse> {
    return this.requests.get(auth, id)
  }

  @ApiOperation({ summary: "Submit a prayer/care request on behalf of a member" })
  @ApiCreatedResponse({ type: CareRequestResponseDto })
  @ApiNotFoundResponse({ description: "Member not found or outside the caller's tag scope" })
  @RequirePermission("care_requests", "create")
  @Post()
  create(
    @CurrentAuth() auth: AuthContext,
    @Body() dto: CareRequestCreateDto,
  ): Promise<CareRequestResponse> {
    return this.requests.create(auth, dto)
  }

  @ApiOperation({ summary: "Edit an open request's type or body" })
  @ApiOkResponse({ type: CareRequestResponseDto })
  @ApiNotFoundResponse({ description: "Request not found or its member is outside the caller's tag scope" })
  @ApiConflictResponse({ description: "Request is closed" })
  @RequirePermission("care_requests", "update")
  @Patch(":id")
  update(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CareRequestUpdateDto,
  ): Promise<CareRequestResponse> {
    return this.requests.update(auth, id, dto)
  }

  @ApiOperation({ summary: "Close a request with an optional note" })
  @ApiOkResponse({ type: CareRequestResponseDto })
  @ApiNotFoundResponse({ description: "Request not found or its member is outside the caller's tag scope" })
  @ApiConflictResponse({ description: "Request is already closed" })
  @RequirePermission("care_requests", "update")
  @HttpCode(200)
  @Post(":id/close")
  close(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CareRequestCloseDto,
  ): Promise<CareRequestResponse> {
    return this.requests.close(auth, id, dto)
  }

  @ApiOperation({ summary: "Reopen a closed request" })
  @ApiOkResponse({ type: CareRequestResponseDto })
  @ApiNotFoundResponse({ description: "Request not found or its member is outside the caller's tag scope" })
  @ApiConflictResponse({ description: "Request is already open" })
  @RequirePermission("care_requests", "update")
  @HttpCode(200)
  @Post(":id/reopen")
  reopen(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<CareRequestResponse> {
    return this.requests.reopen(auth, id)
  }

  @ApiOperation({ summary: "Delete a request" })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: "Request not found or its member is outside the caller's tag scope" })
  @RequirePermission("care_requests", "delete")
  @HttpCode(204)
  @Delete(":id")
  remove(@CurrentAuth() auth: AuthContext, @Param("id", ParseUUIDPipe) id: string): Promise<void> {
    return this.requests.remove(auth, id)
  }
}
