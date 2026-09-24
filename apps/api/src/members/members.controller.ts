import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common"
import { createZodDto } from "nestjs-zod"
import {
  memberCreateSchema,
  memberImportSchema,
  memberUpdateSchema,
  type MemberDetailResponse,
  type MemberImportResult,
  type MemberResponse,
} from "@gembala/shared"
import { CurrentAuth } from "../authz/decorators"
import type { AuthContext } from "../authz/auth-context"
import { MembersService } from "./members.service"

class MemberCreateDto extends createZodDto(memberCreateSchema) {}
class MemberUpdateDto extends createZodDto(memberUpdateSchema) {}
class MemberImportDto extends createZodDto(memberImportSchema) {}

@Controller("members")
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @Get()
  list(
    @CurrentAuth() auth: AuthContext,
    @Query("search") search?: string,
    @Query("tag") tag?: string,
  ): Promise<MemberResponse[]> {
    return this.members.list(auth, search, tag)
  }

  @Post()
  create(@CurrentAuth() auth: AuthContext, @Body() dto: MemberCreateDto): Promise<MemberResponse> {
    return this.members.create(auth, dto)
  }

  @Post("import")
  importMany(
    @CurrentAuth() auth: AuthContext,
    @Body() dto: MemberImportDto,
  ): Promise<MemberImportResult> {
    return this.members.importMany(auth, dto.members)
  }

  @Get(":id")
  detail(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<MemberDetailResponse> {
    return this.members.detail(auth, id)
  }

  @Patch(":id")
  update(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: MemberUpdateDto,
  ): Promise<MemberResponse> {
    return this.members.update(auth, id, dto)
  }
}
