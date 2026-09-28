import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from "@nestjs/common"
import { createZodDto } from "nestjs-zod"
import {
  householdCreateSchema,
  householdUpdateSchema,
  type HouseholdCountResponse,
  type HouseholdResponse,
} from "@gembala/shared"
import { ApiBadRequestResponse, ApiCreatedResponse, ApiForbiddenResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger"
import { HouseholdCountResponseDto, HouseholdResponseDto } from "../swagger/response-dtos"
import { CurrentAuth, RequirePermission } from "../authz/decorators"
import type { AuthContext } from "../authz/auth-context"
import { HouseholdsService } from "./households.service"

class HouseholdCreateDto extends createZodDto(householdCreateSchema) {}
class HouseholdUpdateDto extends createZodDto(householdUpdateSchema) {}

@ApiTags("Households")
@Controller("households")
export class HouseholdsController {
  constructor(private readonly households: HouseholdsService) {}

  @ApiOperation({ summary: "List households" })
  @ApiOkResponse({ type: [HouseholdResponseDto] })
  @RequirePermission("households", "read")
  @Get()
  list(@CurrentAuth() auth: AuthContext): Promise<HouseholdResponse[]> {
    return this.households.list(auth)
  }

  @ApiOperation({ summary: "Count families (households) in scope" })
  @ApiOkResponse({ type: HouseholdCountResponseDto })
  @RequirePermission("households", "read")
  @Get("count")
  count(@CurrentAuth() auth: AuthContext): Promise<HouseholdCountResponse> {
    return this.households.count(auth)
  }

  @ApiOperation({ summary: "Create a household" })
  @ApiCreatedResponse({ type: HouseholdResponseDto })
  @ApiBadRequestResponse({ description: "Unknown member ids, or primary contact is not a household member" })
  @ApiForbiddenResponse({ description: "A member is outside the caller's tag scope" })
  @RequirePermission("households", "create")
  @Post()
  create(@CurrentAuth() auth: AuthContext, @Body() dto: HouseholdCreateDto): Promise<HouseholdResponse> {
    return this.households.create(auth, dto)
  }

  @ApiOperation({ summary: "Get a household" })
  @ApiOkResponse({ type: HouseholdResponseDto })
  @ApiNotFoundResponse({ description: "Household not found" })
  @RequirePermission("households", "read")
  @Get(":id")
  detail(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<HouseholdResponse> {
    return this.households.detail(auth, id)
  }

  @ApiOperation({ summary: "Update a household" })
  @ApiOkResponse({ type: HouseholdResponseDto })
  @ApiNotFoundResponse({ description: "Household not found" })
  @ApiBadRequestResponse({ description: "Primary contact must be a member of this household" })
  @RequirePermission("households", "update")
  @Patch(":id")
  update(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: HouseholdUpdateDto,
  ): Promise<HouseholdResponse> {
    return this.households.update(auth, id, dto)
  }

  @ApiOperation({ summary: "Add a member to a household" })
  @ApiCreatedResponse({ type: HouseholdResponseDto })
  @ApiNotFoundResponse({ description: "Household not found" })
  @ApiForbiddenResponse({ description: "Member is outside the caller's tag scope" })
  @RequirePermission("households", "update")
  @Post(":id/members/:memberId")
  addMember(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("memberId", ParseUUIDPipe) memberId: string,
  ): Promise<HouseholdResponse> {
    return this.households.addMember(auth, id, memberId)
  }

  @ApiOperation({ summary: "Remove a member from a household" })
  @ApiOkResponse({ type: HouseholdResponseDto })
  @ApiNotFoundResponse({ description: "Household not found, or member is not in it" })
  @RequirePermission("households", "update")
  @Delete(":id/members/:memberId")
  removeMember(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("memberId", ParseUUIDPipe) memberId: string,
  ): Promise<HouseholdResponse> {
    return this.households.removeMember(auth, id, memberId)
  }
}
