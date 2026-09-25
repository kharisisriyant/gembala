import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common"
import { createZodDto } from "nestjs-zod"
import {
  memberCreateSchema,
  memberImportSchema,
  memberRelationTypeSchema,
  memberUpdateSchema,
  relationshipCreateSchema,
  type MemberDetailResponse,
  type MemberImportResult,
  type MemberRelationshipResponse,
  type MemberRelationType,
  type MemberResponse,
} from "@gembala/shared"
import { CurrentAuth, RequirePermission } from "../authz/decorators"
import type { AuthContext } from "../authz/auth-context"
import { MembersService } from "./members.service"
import { MemberRelationshipsService } from "./member-relationships.service"

class MemberCreateDto extends createZodDto(memberCreateSchema) {}
class MemberUpdateDto extends createZodDto(memberUpdateSchema) {}
class MemberImportDto extends createZodDto(memberImportSchema) {}
class RelationshipCreateDto extends createZodDto(relationshipCreateSchema) {}

@Controller("members")
export class MembersController {
  constructor(
    private readonly members: MembersService,
    private readonly relationships: MemberRelationshipsService,
  ) {}

  @RequirePermission("members", "read")
  @Get()
  list(
    @CurrentAuth() auth: AuthContext,
    @Query("search") search?: string,
    @Query("tag") tag?: string,
  ): Promise<MemberResponse[]> {
    return this.members.list(auth, search, tag)
  }

  @RequirePermission("members", "create")
  @Post()
  create(@CurrentAuth() auth: AuthContext, @Body() dto: MemberCreateDto): Promise<MemberResponse> {
    return this.members.create(auth, dto)
  }

  @RequirePermission("members", "create")
  @Post("import")
  importMany(
    @CurrentAuth() auth: AuthContext,
    @Body() dto: MemberImportDto,
  ): Promise<MemberImportResult> {
    return this.members.importMany(auth, dto.members)
  }

  @RequirePermission("members", "read")
  @Get(":id")
  detail(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<MemberDetailResponse> {
    return this.members.detail(auth, id)
  }

  @RequirePermission("members", "update")
  @Patch(":id")
  update(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: MemberUpdateDto,
  ): Promise<MemberResponse> {
    return this.members.update(auth, id, dto)
  }

  @RequirePermission("members", "read")
  @Get(":id/relationships")
  listRelationships(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<MemberRelationshipResponse[]> {
    return this.relationships.list(auth, id)
  }

  @RequirePermission("members", "update")
  @Post(":id/relationships")
  createRelationship(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: RelationshipCreateDto,
  ): Promise<MemberRelationshipResponse> {
    return this.relationships.create(auth, id, dto)
  }

  @RequirePermission("members", "update")
  @Delete(":id/relationships/:relatedMemberId/:relationType")
  removeRelationship(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("relatedMemberId", ParseUUIDPipe) relatedMemberId: string,
    @Param("relationType", new ParseEnumPipe(memberRelationTypeSchema.options))
    relationType: MemberRelationType,
  ): Promise<void> {
    return this.relationships.remove(auth, id, relatedMemberId, relationType)
  }
}
