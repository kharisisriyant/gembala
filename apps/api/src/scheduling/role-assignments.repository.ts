import { Injectable } from "@nestjs/common"
import { and, eq } from "drizzle-orm"
import { InjectDb, type Db, type Tx } from "../db/drizzle.module"
import { members, roleAssignments, scheduleEvents, serviceInstances } from "../db/schema"

export type RoleAssignmentInsert = {
  serviceInstanceId: string
  roleTemplateId: string
  memberId: string | null
  freeText: string
  sortOrder: number
}
export type RoleAssignmentPatch = Omit<RoleAssignmentInsert, "serviceInstanceId">

@Injectable()
export class RoleAssignmentsRepository {
  constructor(@InjectDb() private readonly db: Db) {}

  // scopes an instance to the org via its parent event, so nested
  // assignment routes can't reach another org's instance by id
  async findInstanceInOrg(orgId: string, instanceId: string, tx: Db | Tx = this.db) {
    const [row] = await tx
      .select({ id: serviceInstances.id })
      .from(serviceInstances)
      .innerJoin(scheduleEvents, eq(scheduleEvents.id, serviceInstances.eventId))
      .where(and(eq(serviceInstances.id, instanceId), eq(scheduleEvents.orgId, orgId)))
    return row
  }

  async findMemberInOrg(orgId: string, memberId: string, tx: Db | Tx = this.db) {
    const [row] = await tx.select().from(members).where(and(eq(members.id, memberId), eq(members.orgId, orgId)))
    return row
  }

  async findAssignmentInOrg(orgId: string, assignmentId: string, tx: Db | Tx = this.db) {
    const [row] = await tx
      .select({ assignment: roleAssignments })
      .from(roleAssignments)
      .innerJoin(serviceInstances, eq(serviceInstances.id, roleAssignments.serviceInstanceId))
      .innerJoin(scheduleEvents, eq(scheduleEvents.id, serviceInstances.eventId))
      .where(and(eq(roleAssignments.id, assignmentId), eq(scheduleEvents.orgId, orgId)))
    return row?.assignment
  }

  async insert(input: RoleAssignmentInsert, tx: Db | Tx = this.db) {
    const [row] = await tx.insert(roleAssignments).values(input).returning()
    return row
  }

  async update(id: string, patch: RoleAssignmentPatch, tx: Db | Tx = this.db) {
    const [row] = await tx.update(roleAssignments).set(patch).where(eq(roleAssignments.id, id)).returning()
    return row
  }

  async delete(id: string, tx: Db | Tx = this.db) {
    await tx.delete(roleAssignments).where(eq(roleAssignments.id, id))
  }
}
