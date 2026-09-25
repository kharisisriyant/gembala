import { Body, Controller, Delete, HttpCode, Param, ParseUUIDPipe, Post } from "@nestjs/common"
import { createZodDto } from "nestjs-zod"
import { serviceInstanceCreateSchema, type ServiceInstanceResponse } from "@gembala/shared"
import { CurrentAuth, RequirePermission } from "../authz/decorators"
import type { AuthContext } from "../authz/auth-context"
import { ServiceInstancesService } from "./service-instances.service"

class ServiceInstanceCreateDto extends createZodDto(serviceInstanceCreateSchema) {}

@Controller("scheduling")
export class ServiceInstancesController {
  constructor(private readonly serviceInstances: ServiceInstancesService) {}

  @RequirePermission("scheduling", "create")
  @Post("events/:eventId/instances")
  create(
    @CurrentAuth() auth: AuthContext,
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Body() dto: ServiceInstanceCreateDto,
  ): Promise<ServiceInstanceResponse> {
    return this.serviceInstances.create(auth.orgId, eventId, dto)
  }

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
