import { Injectable } from "@nestjs/common"
import { eq } from "drizzle-orm"
import { InjectDb, type Db, type Tx } from "../db/drizzle.module"
import {
  authRateLimits,
  instanceTypes,
  members,
  organizations,
  roleAssignments,
  roleTemplates,
  scheduleEvents,
  serviceInstances,
} from "../db/schema"

export type RosterResponsePatch = Partial<
  Pick<
    typeof roleAssignments.$inferInsert,
    "responseStatus" | "respondedAt" | "declineReason" | "notifiedAt" | "requestedByUserId"
  >
>

@Injectable()
export class RosterResponsesRepository {
  constructor(@InjectDb() private readonly db: Db) {}

  // Everything the link page, the email and the decline notice need, in one query.
  async findContext(assignmentId: string, tx: Db | Tx = this.db) {
    const [row] = await tx
      .select({
        assignment: roleAssignments,
        member: { id: members.id, name: members.name, email: members.email },
        roleName: roleTemplates.name,
        serviceName: instanceTypes.name,
        event: { id: scheduleEvents.id, orgId: scheduleEvents.orgId, date: scheduleEvents.date, theme: scheduleEvents.theme },
        churchName: organizations.name,
      })
      .from(roleAssignments)
      .innerJoin(roleTemplates, eq(roleTemplates.id, roleAssignments.roleTemplateId))
      .innerJoin(serviceInstances, eq(serviceInstances.id, roleAssignments.serviceInstanceId))
      .innerJoin(instanceTypes, eq(instanceTypes.id, serviceInstances.instanceTypeId))
      .innerJoin(scheduleEvents, eq(scheduleEvents.id, serviceInstances.eventId))
      .innerJoin(organizations, eq(organizations.id, scheduleEvents.orgId))
      .leftJoin(members, eq(members.id, roleAssignments.memberId))
      .where(eq(roleAssignments.id, assignmentId))
    return row
  }

  async update(id: string, patch: RosterResponsePatch, tx: Db | Tx = this.db) {
    const [row] = await tx.update(roleAssignments).set(patch).where(eq(roleAssignments.id, id)).returning()
    return row
  }

  // Fixed-window counter in the table auth uses for its limits.
  async consumeRateLimit(key: string, limit: number, windowMs: number, tx: Db | Tx = this.db): Promise<boolean> {
    const now = new Date()
    const [row] = await tx.select().from(authRateLimits).where(eq(authRateLimits.key, key))
    if (!row || row.windowStartedAt.getTime() + windowMs <= now.getTime()) {
      await tx
        .insert(authRateLimits)
        .values({ key, count: 1, windowStartedAt: now, updatedAt: now })
        .onConflictDoUpdate({ target: authRateLimits.key, set: { count: 1, windowStartedAt: now, updatedAt: now } })
      return true
    }
    if (row.count >= limit) return false
    await tx.update(authRateLimits).set({ count: row.count + 1, updatedAt: now }).where(eq(authRateLimits.key, key))
    return true
  }
}
