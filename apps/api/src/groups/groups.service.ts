import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common"
import type {
  AttendanceHeatmapResponse,
  GroupCreateInput,
  GroupDetailResponse,
  GroupSummaryResponse,
  GroupUpdateInput,
  SessionResponse,
} from "@gembala/shared"
import { InjectDb, type Db } from "../db/drizzle.module"
import { ScopeService } from "../authz/scope.service"
import type { AuthContext } from "../authz/auth-context"
import { TagsService } from "../tags/tags.service"
import { MembersService } from "../members/members.service"
import { GroupsRepository } from "./groups.repository"

type GroupRow = {
  id: string
  name: string
  leaderMemberId: string
  scopeTagName: string
  schedule: string
  location: string
}

@Injectable()
export class GroupsService {
  constructor(
    @InjectDb() private readonly db: Db,
    private readonly groups: GroupsRepository,
    private readonly scope: ScopeService,
    private readonly tags: TagsService,
    private readonly members: MembersService,
  ) {}

  private async orgGroups(orgId: string): Promise<GroupRow[]> {
    return this.groups.orgGroupsWithScopeTag(orgId)
  }

  async list(auth: AuthContext): Promise<GroupSummaryResponse[]> {
    const scope = await this.scope.expandedScope(auth)
    const visible = (await this.orgGroups(auth.orgId)).filter((g) =>
      this.scope.groupVisible(scope, g.scopeTagName),
    )
    if (visible.length === 0) return []
    const ids = visible.map((g) => g.id)

    const memberRows = await this.groups.membersByGroupIds(ids)
    const membersByGroup = new Map<string, { id: string; name: string }[]>()
    for (const r of memberRows) {
      const list = membersByGroup.get(r.groupId) ?? []
      list.push({ id: r.memberId, name: r.name })
      membersByGroup.set(r.groupId, list)
    }

    const leaderIds = [...new Set(visible.map((g) => g.leaderMemberId))]
    const leaderRows = await this.groups.membersByIds(leaderIds)
    const leaderById = new Map(leaderRows.map((r) => [r.id, r]))

    const sessionRows = await this.groups.lastSessionsByGroupIds(ids)
    const lastSessionByGroup = new Map<string, { id: string; date: string }>()
    for (const r of sessionRows) {
      const prev = lastSessionByGroup.get(r.groupId)
      if (!prev || r.date > prev.date) lastSessionByGroup.set(r.groupId, { id: r.id, date: r.date })
    }

    const lastSessionIds = [...lastSessionByGroup.values()].map((s) => s.id)
    const presentRows = await this.groups.presentCountsBySessionIds(lastSessionIds)
    const presentCountBySession = new Map<string, number>()
    for (const r of presentRows) {
      presentCountBySession.set(r.sessionId, (presentCountBySession.get(r.sessionId) ?? 0) + 1)
    }

    return visible
      .map((g) => {
        const roster = membersByGroup.get(g.id) ?? []
        const last = lastSessionByGroup.get(g.id)
        return {
          id: g.id,
          name: g.name,
          leader: leaderById.get(g.leaderMemberId) ?? null,
          scopeTag: g.scopeTagName,
          members: roster,
          memberCount: roster.length,
          schedule: g.schedule,
          location: g.location,
          lastSessionDate: last?.date ?? null,
          lastSessionPresent: last ? (presentCountBySession.get(last.id) ?? 0) : null,
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  async create(auth: AuthContext, input: GroupCreateInput): Promise<GroupSummaryResponse> {
    const scope = await this.scope.expandedScope(auth)
    // leaders can only create groups inside their own scope
    this.scope.assertGroupVisible(scope, input.scopeTag)
    const scopeTagId = (await this.tags.resolveTagIds(auth.orgId, [input.scopeTag])).get(
      input.scopeTag,
    )!

    // leader is always part of the roster, matching the prototype's data
    const memberIds = [...new Set([input.leaderId, ...input.memberIds])]
    const memberRows = await this.groups.membersInOrgByIds(auth.orgId, memberIds)
    if (memberRows.length !== memberIds.length) {
      throw new BadRequestException("one or more member ids do not exist in this organization")
    }

    const created = await this.db.transaction(async (tx) => {
      const row = await this.groups.insert(
        {
          orgId: auth.orgId,
          name: input.name,
          leaderMemberId: input.leaderId,
          scopeTagId,
          schedule: input.schedule,
          location: input.location,
        },
        tx,
      )
      await this.groups.insertGroupMembers(row.id, memberIds, tx)
      return row
    })

    const leader = memberRows.find((m) => m.id === input.leaderId) ?? null
    return {
      id: created.id,
      name: created.name,
      leader,
      scopeTag: input.scopeTag,
      members: memberRows,
      memberCount: memberRows.length,
      schedule: created.schedule,
      location: created.location,
      lastSessionDate: null,
      lastSessionPresent: null,
    }
  }

  async update(auth: AuthContext, groupId: string, input: GroupUpdateInput): Promise<GroupSummaryResponse> {
    const existing = await this.requireVisibleGroup(auth, groupId)

    let scopeTagId: string | undefined
    if (input.scopeTag !== undefined) {
      const scope = await this.scope.expandedScope(auth)
      // moving a group also requires visibility into its destination scope
      this.scope.assertGroupVisible(scope, input.scopeTag)
      scopeTagId = (await this.tags.resolveTagIds(auth.orgId, [input.scopeTag])).get(input.scopeTag)!
    }

    const finalLeaderId = input.leaderId ?? existing.leaderMemberId
    const rosterChanged = input.memberIds !== undefined || input.leaderId !== undefined
    let finalMemberIds: string[] = []
    if (rosterChanged) {
      const base = input.memberIds ?? (await this.groups.groupMemberIds(groupId)).map((r) => r.memberId)
      // leader is always part of the roster, matching create()
      finalMemberIds = [...new Set([finalLeaderId, ...base])]
      const memberRows = await this.groups.membersInOrgByIds(auth.orgId, finalMemberIds)
      if (memberRows.length !== finalMemberIds.length) {
        throw new BadRequestException("one or more member ids do not exist in this organization")
      }
    }

    await this.db.transaction(async (tx) => {
      const patch: Partial<{ name: string; leaderMemberId: string; scopeTagId: string; schedule: string; location: string }> = {}
      if (input.name !== undefined) patch.name = input.name
      if (input.leaderId !== undefined) patch.leaderMemberId = input.leaderId
      if (scopeTagId !== undefined) patch.scopeTagId = scopeTagId
      if (input.schedule !== undefined) patch.schedule = input.schedule
      if (input.location !== undefined) patch.location = input.location
      await this.groups.update(auth.orgId, groupId, patch, tx)

      if (rosterChanged) {
        await this.groups.replaceGroupMembers(groupId, finalMemberIds, tx)
      }
    })

    return (await this.list(auth)).find((g) => g.id === groupId)!
  }

  // Shared precondition for detail + attendance logging: group must exist in
  // the caller's org and be inside their scope (403 outside — the UI shows a
  // dedicated "Restricted" view for this).
  async requireVisibleGroup(auth: AuthContext, groupId: string): Promise<GroupRow> {
    const group = (await this.orgGroups(auth.orgId)).find((g) => g.id === groupId)
    if (!group) throw new NotFoundException("group not found")
    const scope = await this.scope.expandedScope(auth)
    this.scope.assertGroupVisible(scope, group.scopeTagName)
    return group
  }

  async detail(auth: AuthContext, groupId: string): Promise<GroupDetailResponse> {
    const group = await this.requireVisibleGroup(auth, groupId)

    const rosterRows = await this.groups.groupMemberIds(groupId)
    const rosterIds = new Set(rosterRows.map((r) => r.memberId))
    const orgMembers = await this.members.orgMembersWithTags(auth.orgId)
    const roster = orgMembers.filter((m) => rosterIds.has(m.id))

    const sessions = await this.sessionsForGroup(groupId)
    const avgAttendance =
      sessions.length === 0
        ? 0
        : Math.round(
            (sessions.reduce((sum, s) => sum + s.presentIds.length, 0) / sessions.length) * 10,
          ) / 10

    return {
      id: group.id,
      name: group.name,
      leader: roster.find((m) => m.id === group.leaderMemberId) ?? null,
      scopeTag: group.scopeTagName,
      schedule: group.schedule,
      location: group.location,
      members: roster,
      sessions,
      stats: {
        meetingsLogged: sessions.length,
        avgAttendance,
        memberCount: roster.length,
      },
    }
  }

  async sessionsForGroup(groupId: string): Promise<SessionResponse[]> {
    const sessionRows = await this.groups.sessionsByGroupId(groupId)
    if (sessionRows.length === 0) return []

    const presentRows = await this.groups.presentRowsBySessionIds(sessionRows.map((s) => s.id))
    const presentBySession = new Map<string, string[]>()
    for (const r of presentRows) {
      const list = presentBySession.get(r.sessionId) ?? []
      list.push(r.memberId)
      presentBySession.set(r.sessionId, list)
    }

    return sessionRows
      .map((s) => ({
        id: s.id,
        groupId: s.groupId,
        date: s.date,
        topic: s.topic,
        prayerNotes: s.prayerNotes,
        presentIds: presentBySession.get(s.id) ?? [],
      }))
      .sort((a, b) => b.date.localeCompare(a.date))
  }

  // Monday-start week buckets, oldest first, ending with the current week.
  async attendanceHeatmap(auth: AuthContext, weeksCount = 52): Promise<AttendanceHeatmapResponse> {
    const scope = await this.scope.expandedScope(auth)
    const visible = (await this.orgGroups(auth.orgId)).filter((g) =>
      this.scope.groupVisible(scope, g.scopeTagName),
    )
    const weeks = weekBuckets(weeksCount)
    if (visible.length === 0) return { weeks, groups: [] }
    const ids = visible.map((g) => g.id)

    const rosterRows = await this.groups.rosterRowsByGroupIds(ids)
    const memberCountByGroup = new Map<string, number>()
    for (const r of rosterRows) {
      memberCountByGroup.set(r.groupId, (memberCountByGroup.get(r.groupId) ?? 0) + 1)
    }

    const sessionRows = await this.groups.sessionRowsSince(ids, weeks[0].start)

    const presentRows = await this.groups.presentCountsBySessionIds(sessionRows.map((s) => s.id))
    const presentCountBySession = new Map<string, number>()
    for (const r of presentRows) {
      presentCountBySession.set(r.sessionId, (presentCountBySession.get(r.sessionId) ?? 0) + 1)
    }

    type WeekAcc = { present: number; sessions: number }
    const accByGroup = new Map<string, WeekAcc[]>()
    for (const g of visible) accByGroup.set(g.id, weeks.map(() => ({ present: 0, sessions: 0 })))

    for (const s of sessionRows) {
      const weekIndex = weeks.findIndex((w) => s.date >= w.start && s.date <= w.end)
      if (weekIndex === -1) continue
      const acc = accByGroup.get(s.groupId)?.[weekIndex]
      if (!acc) continue
      acc.present += presentCountBySession.get(s.id) ?? 0
      acc.sessions += 1
    }

    const groups = visible
      .map((g) => {
        const memberCount = memberCountByGroup.get(g.id) ?? 0
        const cells = accByGroup.get(g.id)!.map((acc) => ({
          present: acc.present,
          sessions: acc.sessions,
          rate:
            acc.sessions === 0 || memberCount === 0
              ? null
              : Math.round((acc.present / (acc.sessions * memberCount)) * 100),
        }))
        return { groupId: g.id, groupName: g.name, memberCount, cells }
      })
      .sort((a, b) => a.groupName.localeCompare(b.groupName))

    return { weeks, groups }
  }
}

function mondayOf(d: Date): Date {
  const daysSinceMonday = (d.getUTCDay() + 6) % 7
  const monday = new Date(d)
  monday.setUTCDate(d.getUTCDate() - daysSinceMonday)
  monday.setUTCHours(0, 0, 0, 0)
  return monday
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function weekBuckets(count: number): { start: string; end: string }[] {
  const thisMonday = mondayOf(new Date())
  const buckets: { start: string; end: string }[] = []
  for (let i = count - 1; i >= 0; i--) {
    const start = new Date(thisMonday)
    start.setUTCDate(thisMonday.getUTCDate() - i * 7)
    const end = new Date(start)
    end.setUTCDate(start.getUTCDate() + 6)
    buckets.push({ start: toISODate(start), end: toISODate(end) })
  }
  return buckets
}
