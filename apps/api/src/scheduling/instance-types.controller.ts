import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from "@nestjs/common"
import { createZodDto } from "nestjs-zod"
import {
  instanceTypeCreateSchema,
  instanceTypeUpdateSchema,
  type InstanceTypeResponse,
} from "@gembala/shared"
import { CurrentAuth, RequirePermission } from "../authz/decorators"
import type { AuthContext } from "../authz/auth-context"
import { InstanceTypesService } from "./instance-types.service"

class InstanceTypeCreateDto extends createZodDto(instanceTypeCreateSchema) {}
class InstanceTypeUpdateDto extends createZodDto(instanceTypeUpdateSchema) {}

@Controller("scheduling/instance-types")
export class InstanceTypesController {
  constructor(private readonly instanceTypes: InstanceTypesService) {}

  @RequirePermission("scheduling", "read")
  @Get()
  list(@CurrentAuth() auth: AuthContext): Promise<InstanceTypeResponse[]> {
    return this.instanceTypes.list(auth.orgId)
  }

  @RequirePermission("scheduling", "create")
  @Post()
  create(
    @CurrentAuth() auth: AuthContext,
    @Body() dto: InstanceTypeCreateDto,
  ): Promise<InstanceTypeResponse> {
    return this.instanceTypes.create(auth.orgId, dto)
  }

  @RequirePermission("scheduling", "update")
  @Patch(":id")
  update(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: InstanceTypeUpdateDto,
  ): Promise<InstanceTypeResponse> {
    return this.instanceTypes.update(auth.orgId, id, dto)
  }

  @RequirePermission("scheduling", "delete")
  @HttpCode(204)
  @Delete(":id")
  async remove(@CurrentAuth() auth: AuthContext, @Param("id", ParseUUIDPipe) id: string): Promise<void> {
    await this.instanceTypes.remove(auth.orgId, id)
  }
}
