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
    }
  }
}
