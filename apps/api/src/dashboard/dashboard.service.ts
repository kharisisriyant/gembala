import { Injectable } from "@nestjs/common"
import type { DashboardResponse } from "@gembala/shared"
import type { AuthContext } from "../authz/auth-context"
import { GroupsService } from "../groups/groups.service"
import { MembersService } from "../members/members.service"
import { ScopeService } from "../authz/scope.service"

@Injectable()
export class DashboardService {
  constructor(
    private readonly scope: ScopeService,
    private readonly members: MembersService,
    private readonly groups: GroupsService,
  ) {}

  // Everything is computed over the caller's visible members/groups, exactly
  // like the prototype dashboard did client-side.
  async summary(auth: AuthContext): Promise<DashboardResponse> {
    const scope = await this.scope.expandedScope(auth)
    const visibleMembers = (await this.members.orgMembersWithTags(auth.orgId)).filter((m) =>
      this.scope.memberVisible(scope, m.tags),
    )
    const visibleGroups = await this.groups.list(auth)

    const memberNameById = new Map(visibleMembers.map((m) => [m.id, m.name]))
    const memberById = new Map(visibleMembers.map((m) => [m.id, m]))
    const visibleMemberIds = new Set(visibleMembers.map((m) => m.id))

    const sessions = (
      await Promise.all(
        visibleGroups.map(async (g) => {
          const groupSessions = await this.groups.sessionsForGroup(g.id)
          return groupSessions.map((s) => ({ ...s, groupName: g.name }))
        }),
      )
    )
      .flat()
      .sort((a, b) => b.date.localeCompare(a.date))

    const groupIdsByMemberId = new Map<string, string[]>()
    for (const group of visibleGroups) {
      for (const member of group.members) {
        if (!visibleMemberIds.has(member.id)) continue
        const groupIds = groupIdsByMemberId.get(member.id) ?? []
        groupIds.push(group.id)
        groupIdsByMemberId.set(member.id, groupIds)
      }
    }

    const today = new Date()
    const upcomingBirthdays = visibleMembers
      .filter((member) => member.dateOfBirth)
      .map((member) => ({
        memberId: member.id,
        name: member.name,
        photoUrl: member.photoUrl,
        dateOfBirth: member.dateOfBirth!,
        daysUntil: daysUntilBirthday(member.dateOfBirth!, today),
      }))
      .filter((member) => member.daysUntil <= 30)
      .sort((a, b) => a.daysUntil - b.daysUntil || a.name.localeCompare(b.name))
      .slice(0, 6)

    const membersWithoutGroup = visibleMembers
      .filter((member) => member.status !== "inactive" && member.status !== "moved")
      .filter((member) => !groupIdsByMemberId.has(member.id))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 6)
      .map((member) => ({ memberId: member.id, name: member.name, photoUrl: member.photoUrl }))

    const attendanceAlerts = visibleGroups.flatMap((group) => {
      const recentGroupSessions = sessions.filter((session) => session.groupId === group.id).slice(0, 3)
      if (recentGroupSessions.length < 3) return []

      return group.members
        .filter((member) => visibleMemberIds.has(member.id))
        .filter((member) => recentGroupSessions.every((session) => !session.presentIds.includes(member.id)))
        .map((member) => ({
          memberId: member.id,
          name: member.name,
          photoUrl: memberById.get(member.id)?.photoUrl ?? "",
          groupId: group.id,
          groupName: group.name,
          missedMeetings: recentGroupSessions.length,
        }))
    }).slice(0, 6)

    const avgAttendance =
      sessions.length === 0
        ? 0
        : Math.round(
            (sessions.reduce((sum, s) => sum + s.presentIds.length, 0) / sessions.length) * 10,
          ) / 10

    const tagCounts: Record<string, number> = {}
    for (const m of visibleMembers) {
      for (const t of m.tags) tagCounts[t] = (tagCounts[t] ?? 0) + 1
    }
    const tagHistogram = Object.entries(tagCounts)
      .filter(([tag]) => tag !== "members")
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([tag, count]) => ({ tag, count }))

    return {
      memberCount: visibleMembers.length,
      activeCount: visibleMembers.filter((m) => m.status === "active").length,
      newcomerCount: visibleMembers.filter((m) => m.status === "newcomer").length,
      groupCount: visibleGroups.length,
      avgAttendance,
      recentSessions: sessions.slice(0, 6).map((s) => ({
        id: s.id,
        groupId: s.groupId,
        groupName: s.groupName,
        date: s.date,
        topic: s.topic,
        presentCount: s.presentIds.length,
        presentNames: s.presentIds
          .map((id) => memberNameById.get(id))
          .filter((n): n is string => Boolean(n)),
      })),
      tagHistogram,
      prayerNotes: sessions.slice(0, 3).map((s) => ({
        groupName: s.groupName,
        date: s.date,
        notes: s.prayerNotes,
      })),
      upcomingBirthdays,
      membersWithoutGroup,
      attendanceAlerts,
    }
  }
}

function daysUntilBirthday(dateOfBirth: string, today: Date): number {
  const [, month, day] = dateOfBirth.split("-").map(Number)
  const currentYear = today.getFullYear()
  let birthday = new Date(currentYear, month - 1, day)
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  if (birthday < startOfToday) birthday = new Date(currentYear + 1, month - 1, day)
  return Math.round((birthday.getTime() - startOfToday.getTime()) / 86_400_000)
}
