import { Injectable } from "@nestjs/common"
import { daysBetweenDates } from "@gembala/shared"
import type { AuthContext } from "../authz/auth-context"
import { ScopeService } from "../authz/scope.service"
import { CareRequestsService } from "../care-requests/care-requests.service"
import { GroupsService } from "../groups/groups.service"
import { JourneyStagesService } from "../journey/journey-stages.service"
import { JourneyService } from "../journey/journey.service"
import { MembersService } from "../members/members.service"
import { absenceItems, birthdaysWithin, type AbsentItem, type BirthdayItem } from "./attention"

export type CareItem = {
  requestId: string
  memberId: string
  memberName: string
  type: "prayer" | "care"
  daysOpen: number
  overdueDays: number
  // Set when the same member is also on the absent list (shown once, annotated).
  alsoAbsentMissed: number | null
}
export type NewcomerItem = { memberId: string; name: string; daysSince: number | null }
export type AttentionItems = {
  care: CareItem[]
  absent: AbsentItem[]
  newcomers: NewcomerItem[]
  // Members waiting on a next step (baptism, sidi, leadership...): counts only.
  nextStep: { stage: string; count: number }[]
  birthdays: BirthdayItem[]
}

const BIRTHDAY_WINDOW_DAYS = 7
const DORMANT_GROUP_DAYS = 60

// Everything one user should look at this week, computed through that user's
// own scope. Callers pass `asOf` (YYYY-MM-DD) so the result is deterministic.
@Injectable()
export class AttentionService {
  constructor(
    private readonly scope: ScopeService,
    private readonly members: MembersService,
    private readonly groups: GroupsService,
    private readonly care: CareRequestsService,
    private readonly journey: JourneyService,
    private readonly stages: JourneyStagesService,
  ) {}

  async forUser(auth: AuthContext, asOf: string): Promise<AttentionItems> {
    const scope = await this.scope.expandedScope(auth)
    const visible = (await this.members.orgMembersWithTags(auth.orgId)).filter((m) => this.scope.memberVisible(scope, m.tags))
    const active = visible.filter((m) => m.status !== "inactive" && m.status !== "moved")
    const visibleIds = new Set(active.map((m) => m.id))

    const groups = await this.groups.list(auth)
    const sessionsByGroup = new Map(
      await Promise.all(groups.map(async (g) => [g.id, await this.groups.sessionsForGroup(g.id)] as const)),
    )
    // One line per member: keep the longest streak across their groups.
    const absent = [...absenceItems(groups, sessionsByGroup, visibleIds, { asOf, dormantAfterDays: DORMANT_GROUP_DAYS })
      .reduce((byMember, item) => {
        const prev = byMember.get(item.memberId)
        if (!prev || item.missed > prev.missed) byMember.set(item.memberId, item)
        return byMember
      }, new Map<string, AbsentItem>()).values()]
      .sort((a, b) => b.missed - a.missed || a.name.localeCompare(b.name))

    const requests = await this.care.list(auth, { status: "open", assignedToUserId: "me" })
    const absentById = new Map(absent.map((a) => [a.memberId, a]))
    const care: CareItem[] = requests
      .map((r) => ({
        requestId: r.id,
        memberId: r.memberId,
        memberName: r.memberName,
        type: r.type,
        daysOpen: daysBetweenDates(r.createdAt.slice(0, 10), asOf),
        overdueDays: r.dueAt ? Math.max(0, daysBetweenDates(r.dueAt, asOf)) : 0,
        alsoAbsentMissed: absentById.get(r.memberId)?.missed ?? null,
        dueAt: r.dueAt ?? "9999-12-31",
        createdAt: r.createdAt,
      }))
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt) || a.createdAt.localeCompare(b.createdAt))
      .map(({ dueAt: _d, createdAt: _c, ...item }) => item)

    // A person on the care list is not repeated under absent / newcomers.
    const careMemberIds = new Set(care.map((c) => c.memberId))
    const absentOnly = absent.filter((a) => !careMemberIds.has(a.memberId))

    const stages = (await this.stages.list(auth)).filter((s) => s.active && s.rule !== "manual")
    const pipelines = await Promise.all(stages.map(async (s) => ({ stage: s, rows: await this.journey.pipeline(auth, { stage: s.id }) })))
    const shown = new Set([...careMemberIds, ...absentOnly.map((a) => a.memberId)])
    const newcomers: NewcomerItem[] = pipelines
      .filter((p) => p.stage.rule === "newcomer_followup")
      .flatMap((p) => p.rows)
      .filter((r) => !shown.has(r.memberId))
      .map((r) => ({ memberId: r.memberId, name: r.memberName, daysSince: r.daysSince }))
    const nextStep = pipelines
      .filter((p) => p.stage.rule !== "newcomer_followup" && p.rows.length > 0)
      .map((p) => ({ stage: p.stage.name, count: p.rows.length }))

    return {
      care,
      absent: absentOnly,
      newcomers,
      nextStep,
      birthdays: birthdaysWithin(active, asOf, BIRTHDAY_WINDOW_DAYS),
    }
  }
}
