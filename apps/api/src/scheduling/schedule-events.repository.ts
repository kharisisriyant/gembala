import { Injectable } from "@nestjs/common"
import { and, eq, inArray } from "drizzle-orm"
import { InjectDb, type Db, type Tx } from "../db/drizzle.module"
import { instanceTypes, members, roleAssignments, scheduleEvents, serviceInstances } from "../db/schema"

export type ScheduleEventPatch = Partial<typeof scheduleEvents.$inferInsert>

@Injectable()
export class ScheduleEventsRepository {
  constructor(@InjectDb() private readonly db: Db) {}

  async listByOrg(orgId: string, tx: Db | Tx = this.db) {
    return tx.select().from(scheduleEvents).where(eq(scheduleEvents.orgId, orgId))
  }

  async findByIdInOrg(orgId: string, id: string, tx: Db | Tx = this.db) {
    const [row] = await tx
      .select()
      .from(scheduleEvents)
      .where(and(eq(scheduleEvents.id, id), eq(scheduleEvents.orgId, orgId)))
    return row
  }

  async instancesWithTypeByEventIds(eventIds: string[], tx: Db | Tx = this.db) {
    if (eventIds.length === 0) return []
    return tx
      .select({ instance: serviceInstances, instanceType: instanceTypes })
      .from(serviceInstances)
      .innerJoin(instanceTypes, eq(instanceTypes.id, serviceInstances.instanceTypeId))
      .where(inArray(serviceInstances.eventId, eventIds))
  }

  async assignmentsWithMemberByInstanceIds(instanceIds: string[], tx: Db | Tx = this.db) {
    if (instanceIds.length === 0) return []
    return tx
      .select({ assignment: roleAssignments, member: members })
      .from(roleAssignments)
      .leftJoin(members, eq(members.id, roleAssignments.memberId))
      .where(inArray(roleAssignments.serviceInstanceId, instanceIds))
  }

  async insert(input: { orgId: string; date: string; scriptureRef: string; theme: string }, tx: Db | Tx = this.db) {
    const [row] = await tx.insert(scheduleEvents).values(input).returning()
    return row
  }

  async update(orgId: string, id: string, patch: ScheduleEventPatch, tx: Db | Tx = this.db) {
    const [row] = await tx
      .update(scheduleEvents)
      .set(patch)
      .where(and(eq(scheduleEvents.id, id), eq(scheduleEvents.orgId, orgId)))
      .returning()
    return row
  }

  async delete(orgId: string, id: string, tx: Db | Tx = this.db) {
    await tx.delete(scheduleEvents).where(and(eq(scheduleEvents.id, id), eq(scheduleEvents.orgId, orgId)))
  }
}
