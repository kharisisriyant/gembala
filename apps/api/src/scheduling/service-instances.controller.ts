import { Body, Controller, Delete, HttpCode, Param, ParseUUIDPipe, Post } from "@nestjs/common"
import { createZodDto } from "nestjs-zod"
import { serviceInstanceCreateSchema, type ServiceInstanceResponse } from "@gembala/shared"
import { ApiConflictResponse, ApiCreatedResponse, ApiNoContentResponse, ApiNotFoundResponse, ApiOperation, ApiTags } from "@nestjs/swagger"
import { ServiceInstanceResponseDto } from "../swagger/response-dtos"
import { CurrentAuth, RequirePermission } from "../authz/decorators"
import type { AuthContext } from "../authz/auth-context"
import { ServiceInstancesService } from "./service-instances.service"

class ServiceInstanceCreateDto extends createZodDto(serviceInstanceCreateSchema) {}

@ApiTags("Scheduling")
@Controller("scheduling")
export class ServiceInstancesController {
  constructor(private readonly serviceInstances: ServiceInstancesService) {}

  @ApiOperation({ summary: "Add a service instance to a schedule event" })
  @ApiCreatedResponse({ type: ServiceInstanceResponseDto })
  @ApiNotFoundResponse({ description: "Schedule event or instance type not found" })
  @ApiConflictResponse({ description: "Instance type is not active" })
  @RequirePermission("scheduling", "create")
  @Post("events/:eventId/instances")
  create(
    @CurrentAuth() auth: AuthContext,
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Body() dto: ServiceInstanceCreateDto,
  ): Promise<ServiceInstanceResponse> {
    return this.serviceInstances.create(auth.orgId, eventId, dto)
  }

  @ApiOperation({ summary: "Remove a service instance" })
  @ApiNoContentResponse({ description: "Deleted" })
  @ApiNotFoundResponse({ description: "Service instance not found" })
  @RequirePermission("scheduling", "delete")
  @HttpCode(204)
  @Delete("instances/:instanceId")
  async remove(
    @CurrentAuth() auth: AuthContext,
    @Param("instanceId", ParseUUIDPipe) instanceId: string,
  ): Promise<void> {
    await this.serviceInstances.remove(auth.orgId, instanceId)
  }
}
