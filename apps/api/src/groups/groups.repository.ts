import { Injectable } from "@nestjs/common"
import { and, eq, gte, inArray } from "drizzle-orm"
import { InjectDb, type Db, type Tx } from "../db/drizzle.module"
import { attendanceSessions, groupMembers, groups, members, sessionAttendance, tags } from "../db/schema"

export type GroupInsert = typeof groups.$inferInsert
export type GroupPatch = Partial<typeof groups.$inferInsert>

@Injectable()
export class GroupsRepository {
  constructor(@InjectDb() private readonly db: Db) {}

  async orgGroupsWithScopeTag(orgId: string, tx: Db | Tx = this.db) {
    return tx
      .select({
        id: groups.id,
        name: groups.name,
        leaderMemberId: groups.leaderMemberId,
        scopeTagName: tags.name,
        schedule: groups.schedule,
        location: groups.location,
      })
      .from(groups)
      .innerJoin(tags, eq(tags.id, groups.scopeTagId))
      .where(eq(groups.orgId, orgId))
  }

  async membersByGroupIds(groupIds: string[], tx: Db | Tx = this.db) {
    if (groupIds.length === 0) return []
    return tx
      .select({ groupId: groupMembers.groupId, memberId: members.id, name: members.name })
      .from(groupMembers)
      .innerJoin(members, eq(members.id, groupMembers.memberId))
      .where(inArray(groupMembers.groupId, groupIds))
  }

  async membersByIds(ids: string[], tx: Db | Tx = this.db) {
    if (ids.length === 0) return []
    return tx.select({ id: members.id, name: members.name }).from(members).where(inArray(members.id, ids))
  }

  async membersInOrgByIds(orgId: string, ids: string[], tx: Db | Tx = this.db) {
    if (ids.length === 0) return []
    return tx
      .select({ id: members.id, name: members.name })
      .from(members)
      .where(and(eq(members.orgId, orgId), inArray(members.id, ids)))
  }

  async lastSessionsByGroupIds(groupIds: string[], tx: Db | Tx = this.db) {
    if (groupIds.length === 0) return []
    return tx
      .select({ id: attendanceSessions.id, groupId: attendanceSessions.groupId, date: attendanceSessions.date })
      .from(attendanceSessions)
      .where(inArray(attendanceSessions.groupId, groupIds))
  }

  async presentCountsBySessionIds(sessionIds: string[], tx: Db | Tx = this.db) {
    if (sessionIds.length === 0) return []
    return tx
      .select({ sessionId: sessionAttendance.sessionId })
      .from(sessionAttendance)
      .where(inArray(sessionAttendance.sessionId, sessionIds))
  }

  async insert(input: GroupInsert, tx: Db | Tx = this.db) {
    const [row] = await tx.insert(groups).values(input).returning()
    return row
  }

  async insertGroupMembers(groupId: string, memberIds: string[], tx: Db | Tx = this.db) {
    if (memberIds.length === 0) return
    await tx.insert(groupMembers).values(memberIds.map((memberId) => ({ groupId, memberId })))
  }

  async groupMemberIds(groupId: string, tx: Db | Tx = this.db) {
    return tx.select({ memberId: groupMembers.memberId }).from(groupMembers).where(eq(groupMembers.groupId, groupId))
  }

  async update(orgId: string, groupId: string, patch: GroupPatch, tx: Db | Tx = this.db) {
    if (Object.keys(patch).length === 0) return
    await tx.update(groups).set(patch).where(and(eq(groups.id, groupId), eq(groups.orgId, orgId)))
  }

  async replaceGroupMembers(groupId: string, memberIds: string[], tx: Db | Tx = this.db) {
    await tx.delete(groupMembers).where(eq(groupMembers.groupId, groupId))
    await this.insertGroupMembers(groupId, memberIds, tx)
  }

  async sessionsByGroupId(groupId: string, tx: Db | Tx = this.db) {
    return tx.select().from(attendanceSessions).where(eq(attendanceSessions.groupId, groupId))
  }

  async presentRowsBySessionIds(sessionIds: string[], tx: Db | Tx = this.db) {
    if (sessionIds.length === 0) return []
    return tx
      .select({ sessionId: sessionAttendance.sessionId, memberId: sessionAttendance.memberId })
      .from(sessionAttendance)
      .where(inArray(sessionAttendance.sessionId, sessionIds))
  }

  async rosterRowsByGroupIds(groupIds: string[], tx: Db | Tx = this.db) {
    if (groupIds.length === 0) return []
    return tx.select({ groupId: groupMembers.groupId }).from(groupMembers).where(inArray(groupMembers.groupId, groupIds))
  }

  async sessionRowsSince(groupIds: string[], sinceDate: string, tx: Db | Tx = this.db) {
    if (groupIds.length === 0) return []
    return tx
      .select({ id: attendanceSessions.id, groupId: attendanceSessions.groupId, date: attendanceSessions.date })
      .from(attendanceSessions)
      .where(and(inArray(attendanceSessions.groupId, groupIds), gte(attendanceSessions.date, sinceDate)))
  }
}
