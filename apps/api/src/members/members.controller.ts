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
import { ApiBadRequestResponse, ApiConflictResponse, ApiCreatedResponse, ApiForbiddenResponse, ApiNoContentResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger"
import { MemberDetailResponseDto, MemberImportResultDto, MemberRelationshipResponseDto, MemberResponseDto } from "../swagger/response-dtos"
import { CurrentAuth, RequirePermission } from "../authz/decorators"
import type { AuthContext } from "../authz/auth-context"
import { MembersService } from "./members.service"
import { MemberRelationshipsService } from "./member-relationships.service"

class MemberCreateDto extends createZodDto(memberCreateSchema) {}
class MemberUpdateDto extends createZodDto(memberUpdateSchema) {}
class MemberImportDto extends createZodDto(memberImportSchema) {}
class RelationshipCreateDto extends createZodDto(relationshipCreateSchema) {}

@ApiTags("Members")
@Controller("members")
export class MembersController {
  constructor(
    private readonly members: MembersService,
    private readonly relationships: MemberRelationshipsService,
  ) {}

  @ApiOperation({ summary: "List members in the caller's scope" })
  @ApiQuery({ name: "search", required: false, description: "Case-insensitive match on name, email or phone" })
  @ApiQuery({ name: "tag", required: false, description: "Only members tagged with this tag or one of its descendants" })
  @ApiOkResponse({ type: [MemberResponseDto] })
  @RequirePermission("members", "read")
  @Get()
  list(
    @CurrentAuth() auth: AuthContext,
    @Query("search") search?: string,
    @Query("tag") tag?: string,
  ): Promise<MemberResponse[]> {
    return this.members.list(auth, search, tag)
  }

  @ApiOperation({ summary: "Create a member" })
  @ApiCreatedResponse({ type: MemberResponseDto })
  @ApiNotFoundResponse({ description: "Unknown tag" })
  @ApiForbiddenResponse({ description: "Member tags must include at least one tag in the caller's scope" })
  @RequirePermission("members", "create")
  @Post()
  create(@CurrentAuth() auth: AuthContext, @Body() dto: MemberCreateDto): Promise<MemberResponse> {
    return this.members.create(auth, dto)
  }

  @ApiOperation({ summary: "Bulk-create members (up to 500); rows that fail are reported, not fatal" })
  @ApiCreatedResponse({ type: MemberImportResultDto })
  @RequirePermission("members", "create")
  @Post("import")
  importMany(
    @CurrentAuth() auth: AuthContext,
    @Body() dto: MemberImportDto,
  ): Promise<MemberImportResult> {
    return this.members.importMany(auth, dto.members)
  }

  @ApiOperation({ summary: "Get a member with the groups they belong to" })
  @ApiOkResponse({ type: MemberDetailResponseDto })
  @ApiNotFoundResponse({ description: "Member not found or outside the caller's tag scope" })
  @RequirePermission("members", "read")
  @Get(":id")
  detail(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<MemberDetailResponse> {
    return this.members.detail(auth, id)
  }

  @ApiOperation({ summary: "Update a member" })
  @ApiOkResponse({ type: MemberResponseDto })
  @ApiNotFoundResponse({ description: "Member not found or outside the caller's tag scope" })
  @ApiForbiddenResponse({ description: "Member tags must include at least one tag in the caller's scope" })
  @RequirePermission("members", "update")
  @Patch(":id")
  update(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: MemberUpdateDto,
  ): Promise<MemberResponse> {
    return this.members.update(auth, id, dto)
  }

  @ApiOperation({ summary: "List a member's family relationships" })
  @ApiOkResponse({ type: [MemberRelationshipResponseDto] })
  @ApiNotFoundResponse({ description: "Member not found or outside the caller's tag scope" })
  @RequirePermission("members", "read")
  @Get(":id/relationships")
  listRelationships(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<MemberRelationshipResponse[]> {
    return this.relationships.list(auth, id)
  }

  @ApiOperation({ summary: "Add a relationship from this member to another" })
  @ApiCreatedResponse({ type: MemberRelationshipResponseDto })
  @ApiBadRequestResponse({ description: "A member cannot be related to themselves" })
  @ApiConflictResponse({ description: "This relationship already exists" })
  @ApiNotFoundResponse({ description: "Member not found or outside the caller's tag scope" })
  @RequirePermission("members", "update")
  @Post(":id/relationships")
  createRelationship(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: RelationshipCreateDto,
  ): Promise<MemberRelationshipResponse> {
    return this.relationships.create(auth, id, dto)
  }

  @ApiOperation({ summary: "Remove a relationship" })
  @ApiNoContentResponse({ description: "Deleted" })
  @ApiNotFoundResponse({ description: "Relationship not found" })
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
