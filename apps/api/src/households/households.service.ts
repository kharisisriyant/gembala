import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common"
import type {
  HouseholdCountResponse,
  HouseholdCreateInput,
  HouseholdResponse,
  HouseholdUpdateInput,
} from "@gembala/shared"
import { InjectDb, type Db } from "../db/drizzle.module"
import { ScopeService } from "../authz/scope.service"
import type { AuthContext } from "../authz/auth-context"
import { MembersService } from "../members/members.service"
import { HouseholdsRepository, type HouseholdSummaryRow } from "./households.repository"

@Injectable()
export class HouseholdsService {
  constructor(
    @InjectDb() private readonly db: Db,
    private readonly households: HouseholdsRepository,
    private readonly scope: ScopeService,
    private readonly members: MembersService,
  ) {}

  // Builds the response for every household in the org, with rosters
  // filtered to the caller's scope, plus the unfiltered member count so
  // callers can tell "legitimately empty household" (totalMemberCount 0)
  // apart from "has members, none visible to this scope" (a leak detail()
  // must 404 on instead of returning a truncated roster).
  private async responses(
    auth: AuthContext,
  ): Promise<{ response: HouseholdResponse; totalMemberCount: number }[]> {
    const rows = await this.households.listSummariesByOrg(auth.orgId)
    if (rows.length === 0) return []

    const scope = await this.scope.expandedScope(auth)
    const orgMembers = await this.members.orgMembersWithTags(auth.orgId)
    const memberRows = await this.households.memberHouseholdIdsByOrg(auth.orgId)
    const visibleById = new Map(
      orgMembers
        .filter((m) => this.scope.memberVisible(scope, m.tags))
        .map((m) => [m.id, { id: m.id, name: m.name }]),
    )

    const rosterByHousehold = new Map<string, { id: string; name: string }[]>()
    const totalCountByHousehold = new Map<string, number>()
    for (const m of memberRows) {
      if (!m.householdId) continue
      totalCountByHousehold.set(m.householdId, (totalCountByHousehold.get(m.householdId) ?? 0) + 1)
      const visible = visibleById.get(m.id)
      if (!visible) continue
      const list = rosterByHousehold.get(m.householdId) ?? []
      list.push(visible)
      rosterByHousehold.set(m.householdId, list)
    }

    return rows.map((h: HouseholdSummaryRow) => {
      const roster = (rosterByHousehold.get(h.id) ?? []).sort((a, b) => a.name.localeCompare(b.name))
      const primaryContact = h.primaryContactMemberId
        ? (visibleById.get(h.primaryContactMemberId) ?? null)
        : null
      return {
        response: {
          id: h.id,
          name: h.name,
          address: h.address,
          primaryContact,
          members: roster,
          memberCount: roster.length,
        },
        totalMemberCount: totalCountByHousehold.get(h.id) ?? 0,
      }
    })
  }

  async list(auth: AuthContext): Promise<HouseholdResponse[]> {
    return (await this.responses(auth))
      .map((h) => h.response)
      .filter((h) => h.memberCount > 0)
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  async count(auth: AuthContext): Promise<HouseholdCountResponse> {
    const visible = await this.list(auth)
    return { totalFamilies: visible.length }
  }

  async detail(auth: AuthContext, id: string): Promise<HouseholdResponse> {
    const all = await this.responses(auth)
    const household = all.find((h) => h.response.id === id)
    // 404 both for unknown ids and households whose members exist but are
    // all outside this scope (don't leak existence). A household that is
    // genuinely empty (totalMemberCount 0) is still returned.
    if (!household || (household.totalMemberCount > 0 && household.response.memberCount === 0)) {
      throw new NotFoundException("household not found")
    }
    return household.response
  }

  // Resolves + validates a set of member ids against the org and the
  // caller's scope. Throws BadRequestException for unknown ids and
  // ForbiddenException for ids outside the caller's scope (mirrors
  // MembersService/GroupsService's existing validation shape).
  private async assertAssignable(auth: AuthContext, memberIds: string[]): Promise<void> {
    if (memberIds.length === 0) return
    const orgMembers = await this.members.orgMembersWithTags(auth.orgId)
    const byId = new Map(orgMembers.map((m) => [m.id, m]))
    const missing = memberIds.filter((id) => !byId.has(id))
    if (missing.length > 0) {
      throw new BadRequestException("one or more member ids do not exist in this organization")
    }
    const scope = await this.scope.expandedScope(auth)
    for (const id of memberIds) {
      const member = byId.get(id)!
      if (!this.scope.memberVisible(scope, member.tags)) {
        throw new ForbiddenException("member is outside your scope")
      }
    }
  }

  async create(auth: AuthContext, input: HouseholdCreateInput): Promise<HouseholdResponse> {
    const memberIds = [...new Set(input.memberIds ?? [])]
    if (input.primaryContactMemberId && !memberIds.includes(input.primaryContactMemberId)) {
      throw new BadRequestException("primary contact must be one of the household's members")
    }
    await this.assertAssignable(auth, memberIds)

    const created = await this.db.transaction(async (tx) => {
      const row = await this.households.insert(
        {
          orgId: auth.orgId,
          name: input.name,
          address: input.address,
          primaryContactMemberId: input.primaryContactMemberId,
        },
        tx,
      )
      await this.households.assignMembersToHousehold(auth.orgId, memberIds, row.id, tx)
      return row
    })

    return this.detail(auth, created.id)
  }

  private async requireHousehold(auth: AuthContext, id: string) {
    const row = await this.households.findByIdInOrg(auth.orgId, id)
    if (!row) throw new NotFoundException("household not found")
    return row
  }

  async update(auth: AuthContext, id: string, input: HouseholdUpdateInput): Promise<HouseholdResponse> {
    await this.requireHousehold(auth, id)

    if (input.primaryContactMemberId) {
      const member = await this.households.findMemberHouseholdId(auth.orgId, input.primaryContactMemberId)
      if (!member || member.householdId !== id) {
        throw new BadRequestException("primary contact must be a member of this household")
      }
    }

    const patch: Parameters<HouseholdsRepository["update"]>[1] = {}
    if (input.name !== undefined) patch.name = input.name
    if (input.address !== undefined) patch.address = input.address
    if (input.primaryContactMemberId !== undefined) {
      patch.primaryContactMemberId = input.primaryContactMemberId
    }
    await this.households.update(id, patch)

    return this.detail(auth, id)
  }

  async addMember(auth: AuthContext, householdId: string, memberId: string): Promise<HouseholdResponse> {
    await this.requireHousehold(auth, householdId)
    await this.assertAssignable(auth, [memberId])

    await this.households.setMemberHousehold(auth.orgId, memberId, householdId)

    return this.detail(auth, householdId)
  }

  async removeMember(auth: AuthContext, householdId: string, memberId: string): Promise<HouseholdResponse> {
    await this.requireHousehold(auth, householdId)
    const member = await this.households.findMemberHouseholdId(auth.orgId, memberId)
    if (!member || member.householdId !== householdId) {
      throw new NotFoundException("member not found in this household")
    }

    await this.households.setMemberHousehold(auth.orgId, memberId, null)
    // clear primary contact if it pointed at the member we just removed
    await this.households.clearPrimaryContactIfMember(householdId, memberId)

    return this.detail(auth, householdId)
  }
}
