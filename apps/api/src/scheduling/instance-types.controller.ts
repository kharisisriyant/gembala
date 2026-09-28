import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from "@nestjs/common"
import { createZodDto } from "nestjs-zod"
import {
  instanceTypeCreateSchema,
  instanceTypeUpdateSchema,
  type InstanceTypeResponse,
} from "@gembala/shared"
import { ApiCreatedResponse, ApiNoContentResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger"
import { InstanceTypeResponseDto } from "../swagger/response-dtos"
import { CurrentAuth, RequirePermission } from "../authz/decorators"
import type { AuthContext } from "../authz/auth-context"
import { InstanceTypesService } from "./instance-types.service"

class InstanceTypeCreateDto extends createZodDto(instanceTypeCreateSchema) {}
class InstanceTypeUpdateDto extends createZodDto(instanceTypeUpdateSchema) {}

@ApiTags("Scheduling")
@Controller("scheduling/instance-types")
export class InstanceTypesController {
  constructor(private readonly instanceTypes: InstanceTypesService) {}

  @ApiOperation({ summary: "List service instance types (e.g. Morning Service)" })
  @ApiOkResponse({ type: [InstanceTypeResponseDto] })
  @RequirePermission("scheduling", "read")
  @Get()
  list(@CurrentAuth() auth: AuthContext): Promise<InstanceTypeResponse[]> {
    return this.instanceTypes.list(auth.orgId)
  }

  @ApiOperation({ summary: "Create an instance type" })
  @ApiCreatedResponse({ type: InstanceTypeResponseDto })
  @RequirePermission("scheduling", "create")
  @Post()
  create(
    @CurrentAuth() auth: AuthContext,
    @Body() dto: InstanceTypeCreateDto,
  ): Promise<InstanceTypeResponse> {
    return this.instanceTypes.create(auth.orgId, dto)
  }

  @ApiOperation({ summary: "Update an instance type" })
  @ApiOkResponse({ type: InstanceTypeResponseDto })
  @ApiNotFoundResponse({ description: "Instance type not found" })
  @RequirePermission("scheduling", "update")
  @Patch(":id")
  update(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: InstanceTypeUpdateDto,
  ): Promise<InstanceTypeResponse> {
    return this.instanceTypes.update(auth.orgId, id, dto)
  }

  @ApiOperation({ summary: "Delete an instance type" })
  @ApiNoContentResponse({ description: "Deleted" })
  @ApiNotFoundResponse({ description: "Instance type not found" })
  @RequirePermission("scheduling", "delete")
  @HttpCode(204)
  @Delete(":id")
  async remove(@CurrentAuth() auth: AuthContext, @Param("id", ParseUUIDPipe) id: string): Promise<void> {
    await this.instanceTypes.remove(auth.orgId, id)
  }
}
