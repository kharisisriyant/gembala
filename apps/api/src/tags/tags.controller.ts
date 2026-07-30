import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from "@nestjs/common"
import { createZodDto } from "nestjs-zod"
import { tagCreateSchema, tagUpdateSchema, type TagResponse } from "@gembala/shared"
import { CurrentAuth, Roles } from "../authz/decorators"
import type { AuthContext } from "../authz/auth-context"
import { TagsService } from "./tags.service"

class TagCreateDto extends createZodDto(tagCreateSchema) {}
class TagUpdateDto extends createZodDto(tagUpdateSchema) {}

@Controller("tags")
export class TagsController {
  constructor(private readonly tags: TagsService) {}

  @Get()
  list(@CurrentAuth() auth: AuthContext): Promise<TagResponse[]> {
    return this.tags.list(auth.orgId)
  }

  @Roles("admin")
  @Post()
  create(@CurrentAuth() auth: AuthContext, @Body() dto: TagCreateDto): Promise<TagResponse> {
    return this.tags.create(auth.orgId, dto)
  }

  @Roles("admin")
  @HttpCode(204)
  @Patch(":name")
  async update(
    @CurrentAuth() auth: AuthContext,
    @Param("name") name: string,
    @Body() dto: TagUpdateDto,
  ): Promise<void> {
    await this.tags.update(auth.orgId, name, dto)
  }

  @Roles("admin")
  @HttpCode(204)
  @Delete(":name")
  async remove(@CurrentAuth() auth: AuthContext, @Param("name") name: string): Promise<void> {
    await this.tags.remove(auth.orgId, name)
  }
}
