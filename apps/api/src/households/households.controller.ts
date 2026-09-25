import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from "@nestjs/common"
import { createZodDto } from "nestjs-zod"
import {
  householdCreateSchema,
  householdUpdateSchema,
  type HouseholdCountResponse,
  type HouseholdResponse,
} from "@gembala/shared"
import { CurrentAuth } from "../authz/decorators"
import type { AuthContext } from "../authz/auth-context"
import { HouseholdsService } from "./households.service"

class HouseholdCreateDto extends createZodDto(householdCreateSchema) {}
class HouseholdUpdateDto extends createZodDto(householdUpdateSchema) {}

@Controller("households")
export class HouseholdsController {
  constructor(private readonly households: HouseholdsService) {}

  @Get()
  list(@CurrentAuth() auth: AuthContext): Promise<HouseholdResponse[]> {
    return this.households.list(auth)
  }

  @Get("count")
  count(@CurrentAuth() auth: AuthContext): Promise<HouseholdCountResponse> {
    return this.households.count(auth)
  }

  @Post()
  create(@CurrentAuth() auth: AuthContext, @Body() dto: HouseholdCreateDto): Promise<HouseholdResponse> {
    return this.households.create(auth, dto)
  }

  @Get(":id")
  detail(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<HouseholdResponse> {
    return this.households.detail(auth, id)
  }

  @Patch(":id")
  update(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: HouseholdUpdateDto,
  ): Promise<HouseholdResponse> {
    return this.households.update(auth, id, dto)
  }

  @Post(":id/members/:memberId")
  addMember(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("memberId", ParseUUIDPipe) memberId: string,
  ): Promise<HouseholdResponse> {
    return this.households.addMember(auth, id, memberId)
  }

  @Delete(":id/members/:memberId")
  removeMember(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("memberId", ParseUUIDPipe) memberId: string,
  ): Promise<HouseholdResponse> {
    return this.households.removeMember(auth, id, memberId)
  }
}
