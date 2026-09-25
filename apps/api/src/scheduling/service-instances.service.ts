import { ConflictException, Injectable, NotFoundException } from "@nestjs/common"
import type {
  InstanceTypeResponse,
  ServiceInstanceCreateInput,
  ServiceInstanceResponse,
} from "@gembala/shared"
import { serviceInstances } from "../db/schema"
import { InstanceTypesService } from "./instance-types.service"
import { ServiceInstancesRepository } from "./service-instances.repository"

type ServiceInstanceRow = typeof serviceInstances.$inferSelect

function toResponse(row: ServiceInstanceRow, instanceType: InstanceTypeResponse): ServiceInstanceResponse {
  return {
    id: row.id,
    eventId: row.eventId,
    instanceType: { id: instanceType.id, name: instanceType.name },
    sortOrder: row.sortOrder,
  }
}

@Injectable()
export class ServiceInstancesService {
  constructor(
    private readonly instances: ServiceInstancesRepository,
    private readonly instanceTypes: InstanceTypesService,
  ) {}

  // scopes an event to the org, so nested instance routes can't be used to
  // reach another org's event by id
  async loadEventScoped(orgId: string, eventId: string) {
    const row = await this.instances.findEventInOrg(orgId, eventId)
    if (!row) throw new NotFoundException("schedule event not found")
    return row
  }

  // scopes an instance to the org via its parent event
  async loadInstanceScoped(orgId: string, instanceId: string): Promise<ServiceInstanceRow> {
    const row = await this.instances.findInstanceInOrg(orgId, instanceId)
    if (!row) throw new NotFoundException("service instance not found")
    return row
  }

  async create(
    orgId: string,
    eventId: string,
    input: ServiceInstanceCreateInput,
  ): Promise<ServiceInstanceResponse> {
    await this.loadEventScoped(orgId, eventId)
    const instanceType = await this.instanceTypes.detail(orgId, input.instanceTypeId)
    if (!instanceType.isActive) throw new ConflictException("instance type is not active")

    const row = await this.instances.insert({
      eventId,
      instanceTypeId: input.instanceTypeId,
      sortOrder: input.sortOrder,
    })
    return toResponse(row, instanceType)
  }

  async remove(orgId: string, instanceId: string): Promise<void> {
    await this.loadInstanceScoped(orgId, instanceId)
    await this.instances.delete(instanceId)
  }
}
