import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from "@nestjs/common"
import { createZodDto } from "nestjs-zod"
import { tagCreateSchema, tagUpdateSchema, type TagResponse } from "@gembala/shared"
import { ApiConflictResponse, ApiCreatedResponse, ApiNoContentResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger"
import { TagResponseDto } from "../swagger/response-dtos"
import { CurrentAuth, RequirePermission } from "../authz/decorators"
import type { AuthContext } from "../authz/auth-context"
import { TagsService } from "./tags.service"

class TagCreateDto extends createZodDto(tagCreateSchema) {}
class TagUpdateDto extends createZodDto(tagUpdateSchema) {}

@ApiTags("Tags")
@Controller("tags")
export class TagsController {
  constructor(private readonly tags: TagsService) {}

  @ApiOperation({ summary: "List tags with member counts" })
  @ApiOkResponse({ type: [TagResponseDto] })
  @RequirePermission("tags", "read")
  @Get()
  list(@CurrentAuth() auth: AuthContext): Promise<TagResponse[]> {
    return this.tags.list(auth.orgId)
  }

  @ApiOperation({ summary: "Create a tag" })
  @ApiCreatedResponse({ type: TagResponseDto })
  @ApiConflictResponse({ description: "Tag already exists" })
  @ApiNotFoundResponse({ description: "Parent tag not found" })
  @RequirePermission("tags", "create")
  @Post()
  create(@CurrentAuth() auth: AuthContext, @Body() dto: TagCreateDto): Promise<TagResponse> {
    return this.tags.create(auth.orgId, dto)
  }

  @ApiOperation({ summary: "Change a tag's parent or description" })
  @ApiNoContentResponse({ description: "Updated" })
  @ApiNotFoundResponse({ description: "Tag or parent tag not found" })
  @ApiConflictResponse({ description: "Cannot move a tag under its own subtree" })
  @RequirePermission("tags", "update")
  @HttpCode(204)
  @Patch(":name")
  async update(
    @CurrentAuth() auth: AuthContext,
    @Param("name") name: string,
    @Body() dto: TagUpdateDto,
  ): Promise<void> {
    await this.tags.update(auth.orgId, name, dto)
  }

  @ApiOperation({ summary: "Delete a tag" })
  @ApiNoContentResponse({ description: "Deleted" })
  @ApiNotFoundResponse({ description: "Tag not found" })
  @ApiConflictResponse({ description: "Tag is still in use" })
  @RequirePermission("tags", "delete")
  @HttpCode(204)
  @Delete(":name")
  async remove(@CurrentAuth() auth: AuthContext, @Param("name") name: string): Promise<void> {
    await this.tags.remove(auth.orgId, name)
  }
}
