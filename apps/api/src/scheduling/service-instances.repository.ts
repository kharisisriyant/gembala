import { Injectable } from "@nestjs/common"
import { and, eq } from "drizzle-orm"
import { InjectDb, type Db, type Tx } from "../db/drizzle.module"
import { scheduleEvents, serviceInstances } from "../db/schema"

@Injectable()
export class ServiceInstancesRepository {
  constructor(@InjectDb() private readonly db: Db) {}

  async findEventInOrg(orgId: string, eventId: string, tx: Db | Tx = this.db) {
    const [row] = await tx
      .select()
      .from(scheduleEvents)
      .where(and(eq(scheduleEvents.id, eventId), eq(scheduleEvents.orgId, orgId)))
    return row
  }

  // scopes an instance to the org via its parent event
  async findInstanceInOrg(orgId: string, instanceId: string, tx: Db | Tx = this.db) {
    const [row] = await tx
      .select({ instance: serviceInstances })
      .from(serviceInstances)
      .innerJoin(scheduleEvents, eq(scheduleEvents.id, serviceInstances.eventId))
      .where(and(eq(serviceInstances.id, instanceId), eq(scheduleEvents.orgId, orgId)))
    return row?.instance
  }

  async insert(
    input: { eventId: string; instanceTypeId: string; sortOrder: number },
    tx: Db | Tx = this.db,
  ) {
    const [row] = await tx.insert(serviceInstances).values(input).returning()
    return row
  }

  async delete(instanceId: string, tx: Db | Tx = this.db) {
    await tx.delete(serviceInstances).where(eq(serviceInstances.id, instanceId))
  }
}
