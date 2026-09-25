import { ConflictException, Injectable, NotFoundException } from "@nestjs/common"
import type {
  InstanceTypeResponse,
  ServiceInstanceCreateInput,
  ServiceInstanceResponse,
} from "@gembala/shared"
import { and, eq } from "drizzle-orm"
import { InjectDb, type Db } from "../db/drizzle.module"
import { scheduleEvents, serviceInstances } from "../db/schema"
import { InstanceTypesService } from "./instance-types.service"

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
    @InjectDb() private readonly db: Db,
    private readonly instanceTypes: InstanceTypesService,
  ) {}

  // scopes an event to the org, so nested instance routes can't be used to
  // reach another org's event by id
  async loadEventScoped(orgId: string, eventId: string) {
    const [row] = await this.db
      .select()
      .from(scheduleEvents)
      .where(and(eq(scheduleEvents.id, eventId), eq(scheduleEvents.orgId, orgId)))
    if (!row) throw new NotFoundException("schedule event not found")
    return row
  }

  // scopes an instance to the org via its parent event
  async loadInstanceScoped(orgId: string, instanceId: string): Promise<ServiceInstanceRow> {
    const [row] = await this.db
      .select({ instance: serviceInstances })
      .from(serviceInstances)
      .innerJoin(scheduleEvents, eq(scheduleEvents.id, serviceInstances.eventId))
      .where(and(eq(serviceInstances.id, instanceId), eq(scheduleEvents.orgId, orgId)))
    if (!row) throw new NotFoundException("service instance not found")
    return row.instance
  }

  async create(
    orgId: string,
    eventId: string,
    input: ServiceInstanceCreateInput,
  ): Promise<ServiceInstanceResponse> {
    await this.loadEventScoped(orgId, eventId)
    const instanceType = await this.instanceTypes.detail(orgId, input.instanceTypeId)
    if (!instanceType.isActive) throw new ConflictException("instance type is not active")

    const [row] = await this.db
      .insert(serviceInstances)
      .values({ eventId, instanceTypeId: input.instanceTypeId, sortOrder: input.sortOrder })
      .returning()
    return toResponse(row, instanceType)
  }

  async remove(orgId: string, instanceId: string): Promise<void> {
    await this.loadInstanceScoped(orgId, instanceId)
    await this.db.delete(serviceInstances).where(eq(serviceInstances.id, instanceId))
  }
}
