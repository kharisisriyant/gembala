import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common"
import type {
  CareRequestAssigneeResponse,
  CareRequestCloseInput,
  CareRequestCreateInput,
  CareRequestResponse,
  CareRequestUpdateInput,
} from "@gembala/shared"
import { addDays, canTransition, careRequestLifecycle, daysBetweenDates, todayInZone } from "@gembala/shared"
import { AuthContextService } from "../authz/auth-context.service"
import { ScopeService } from "../authz/scope.service"
import type { AuthContext } from "../authz/auth-context"
import {
  CareRequestsRepository,
  type CareRequestFilters,
  type CareRequestRow,
} from "./care-requests.repository"

// Who filed the request. `member` is reserved for the future member-facing
// endpoint; v1 only ever passes `leader`.
export type CareRequestListQuery = Omit<CareRequestFilters, "assignedToUserId" | "overdueBefore"> & {
  assignedToUserId?: string | "me"
  overdue?: boolean
}

// Org-wide view of open requests for the admin digest.
export type CareOpenSummary = {
  byOwner: { name: string; open: number; overdue: number }[]
  unassigned: number
  // Assigned, but the owner can no longer see the member (scope changed).
  ownerCannotSee: number
  longestOverdue: { memberName: string; type: "prayer" | "care"; ownerName: string | null; overdueDays: number }[]
}

export type CareRequestSubmitter =
  | { source: "leader"; userId: string }
  | { source: "member"; memberId: string }

@Injectable()
export class CareRequestsService {
  constructor(
    private readonly requests: CareRequestsRepository,
    private readonly scope: ScopeService,
    private readonly authContext: AuthContextService,
  ) {}

  // Default follow-up window for a new request.
  static readonly DEFAULT_DUE_DAYS = 7

  private toResponse(r: CareRequestRow): CareRequestResponse {
    return {
      id: r.id,
      memberId: r.memberId,
      memberName: r.memberName,
      type: r.type,
      body: r.body,
      status: r.status,
      source: r.source,
      submittedBy: r.submittedById && r.submittedByName ? { id: r.submittedById, name: r.submittedByName } : null,
      assignedTo: r.assignedToId && r.assignedToName ? { id: r.assignedToId, name: r.assignedToName } : null,
      dueAt: r.dueAt,
      overdue: r.status === "open" && r.dueAt !== null && r.dueAt < todayInZone(),
      closedAt: r.closedAt ? r.closedAt.toISOString() : null,
      closedBy: r.closedById && r.closedByName ? { id: r.closedById, name: r.closedByName } : null,
      closeNote: r.closeNote,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }
  }

  // Visibility follows the request's member: visible iff the caller can see
  // the member. Missing and out-of-scope both read as 404 (don't leak existence).
  private async visibleRow(auth: AuthContext, id: string): Promise<CareRequestRow> {
    const row = await this.requests.findById(auth.orgId, id)
    if (!row) throw new NotFoundException("request not found")
    const scope = await this.scope.expandedScope(auth)
    const tagRows = await this.requests.tagNamesByMemberIds([row.memberId])
    if (!this.scope.memberVisible(scope, tagRows.map((t) => t.name))) {
      throw new NotFoundException("request not found")
    }
    return row
  }

  async list(auth: AuthContext, query: CareRequestListQuery): Promise<CareRequestResponse[]> {
    const { assignedToUserId, overdue, ...rest } = query
    const filters: CareRequestFilters = {
      ...rest,
      assignedToUserId: assignedToUserId === "me" ? auth.userId : assignedToUserId,
      overdueBefore: overdue ? todayInZone() : undefined,
    }
    const rows = await this.requests.list(auth.orgId, filters)
    const scope = await this.scope.expandedScope(auth)
    const tagRows = await this.requests.tagNamesByMemberIds([...new Set(rows.map((r) => r.memberId))])
    const tagsByMember = new Map<string, string[]>()
    for (const t of tagRows) {
      const list = tagsByMember.get(t.memberId) ?? []
      list.push(t.name)
      tagsByMember.set(t.memberId, list)
    }
    return rows
      .filter((r) => this.scope.memberVisible(scope, tagsByMember.get(r.memberId) ?? []))
      .map((r) => this.toResponse(r))
  }

  async get(auth: AuthContext, id: string): Promise<CareRequestResponse> {
    return this.toResponse(await this.visibleRow(auth, id))
  }

  async create(auth: AuthContext, input: CareRequestCreateInput): Promise<CareRequestResponse> {
    const tagNames = await this.visibleMemberTags(auth, input.memberId)
    const assignedToUserId = input.assignedToUserId ?? auth.userId
    if (assignedToUserId !== auth.userId) {
      await this.assertAssignee(auth.orgId, assignedToUserId, tagNames)
    }
    return this.insert(auth.orgId, { ...input, assignedToUserId }, { source: "leader", userId: auth.userId })
  }

  async openSummary(auth: AuthContext, limit = 5): Promise<CareOpenSummary> {
    if (!auth.isSystemAdmin) throw new ForbiddenException("admin only")
    const rows = await this.requests.list(auth.orgId, { status: "open" })
    const today = todayInZone()
    const tagRows = await this.requests.tagNamesByMemberIds([...new Set(rows.map((r) => r.memberId))])
    const tagsByMember = new Map<string, string[]>()
    for (const t of tagRows) tagsByMember.set(t.memberId, [...(tagsByMember.get(t.memberId) ?? []), t.name])

    const scopeByOwner = new Map<string, Set<string> | null | undefined>() // undefined = owner unknown
    for (const id of new Set(rows.map((r) => r.assignedToId).filter((id): id is string => id !== null))) {
      const ctx = await this.authContext.load(id)
      scopeByOwner.set(id, ctx ? await this.scope.expandedScope(ctx) : undefined)
    }

    const owners = new Map<string, { name: string; open: number; overdue: number }>()
    let unassigned = 0
    let ownerCannotSee = 0
    for (const r of rows) {
      const overdue = r.dueAt !== null && r.dueAt < today
      if (!r.assignedToId) { unassigned++; continue }
      const o = owners.get(r.assignedToId) ?? { name: r.assignedToName ?? "?", open: 0, overdue: 0 }
      o.open++
      if (overdue) o.overdue++
      owners.set(r.assignedToId, o)
      const scope = scopeByOwner.get(r.assignedToId)
      if (scope === undefined || !this.scope.memberVisible(scope, tagsByMember.get(r.memberId) ?? [])) ownerCannotSee++
    }
    const longestOverdue = rows
      .filter((r) => r.dueAt !== null && r.dueAt < today)
      .sort((a, b) => a.dueAt!.localeCompare(b.dueAt!))
      .slice(0, limit)
      .map((r) => ({ memberName: r.memberName, type: r.type, ownerName: r.assignedToName, overdueDays: daysBetweenDates(r.dueAt!, today) }))
    return {
      byOwner: [...owners.values()].sort((a, b) => b.overdue - a.overdue || b.open - a.open || a.name.localeCompare(b.name)),
      unassigned,
      ownerCannotSee,
      longestOverdue,
    }
  }

  // The people who could own a request about this member: active org users who
  // can themselves see the member (an owner who cannot open it is useless).
  async assignees(auth: AuthContext, memberId: string): Promise<CareRequestAssigneeResponse[]> {
    const tagNames = await this.visibleMemberTags(auth, memberId)
    const users = await this.requests.orgUsers(auth.orgId)
    const visible = await Promise.all(users.map(async (u) => ((await this.canSee(u.id, tagNames)) ? u : null)))
    return visible.filter((u): u is CareRequestAssigneeResponse => u !== null)
  }

  private async visibleMemberTags(auth: AuthContext, memberId: string): Promise<string[]> {
    const member = await this.requests.findMember(auth.orgId, memberId)
    const scope = await this.scope.expandedScope(auth)
    const tagRows = member ? await this.requests.tagNamesByMemberIds([member.id]) : []
    const names = tagRows.map((t) => t.name)
    if (!member || !this.scope.memberVisible(scope, names)) throw new NotFoundException("member not found")
    return names
  }

  private async canSee(userId: string, memberTagNames: string[]): Promise<boolean> {
    const ctx = await this.authContext.load(userId)
    if (!ctx) return false
    return this.scope.memberVisible(await this.scope.expandedScope(ctx), memberTagNames)
  }

  private async assertAssignee(orgId: string, userId: string, memberTagNames: string[]): Promise<void> {
    const users = await this.requests.orgUsers(orgId)
    if (!users.some((u) => u.id === userId)) throw new NotFoundException("user not found")
    if (!(await this.canSee(userId, memberTagNames))) {
      throw new UnprocessableEntityException("assignee cannot see this member")
    }
  }

  private async insert(
    orgId: string,
    input: CareRequestCreateInput,
    submitter: CareRequestSubmitter,
  ): Promise<CareRequestResponse> {
    const { id } = await this.requests.insert({
      orgId,
      memberId: input.memberId,
      type: input.type,
      body: input.body,
      source: submitter.source,
      submittedByUserId: submitter.source === "leader" ? submitter.userId : null,
      assignedToUserId: input.assignedToUserId ?? null,
      dueAt: input.dueAt ?? addDays(todayInZone(), CareRequestsService.DEFAULT_DUE_DAYS),
    })
    const row = await this.requests.findById(orgId, id)
    return this.toResponse(row!)
  }

  async update(auth: AuthContext, id: string, input: CareRequestUpdateInput): Promise<CareRequestResponse> {
    const row = await this.visibleRow(auth, id)
    if (row.status === "closed") throw new ConflictException("closed requests cannot be edited; reopen first")
    if (input.assignedToUserId && input.assignedToUserId !== row.assignedToId) {
      const tagRows = await this.requests.tagNamesByMemberIds([row.memberId])
      await this.assertAssignee(auth.orgId, input.assignedToUserId, tagRows.map((t) => t.name))
    }
    await this.requests.update(auth.orgId, id, {
      type: input.type,
      body: input.body,
      assignedToUserId: input.assignedToUserId,
      dueAt: input.dueAt,
    })
    return this.get(auth, id)
  }

  async close(auth: AuthContext, id: string, input: CareRequestCloseInput): Promise<CareRequestResponse> {
    const row = await this.visibleRow(auth, id)
    if (!canTransition(careRequestLifecycle, row.status, "closed")) throw new ConflictException("request is already closed")
    await this.requests.update(auth.orgId, id, {
      status: "closed",
      closedAt: new Date(),
      closedByUserId: auth.userId,
      closeNote: input.note || null,
    })
    return this.get(auth, id)
  }

  async reopen(auth: AuthContext, id: string): Promise<CareRequestResponse> {
    const row = await this.visibleRow(auth, id)
    if (!canTransition(careRequestLifecycle, row.status, "open")) throw new ConflictException("request is already open")
    await this.requests.update(auth.orgId, id, {
      status: "open",
      closedAt: null,
      closedByUserId: null,
      closeNote: null,
    })
    return this.get(auth, id)
  }

  async remove(auth: AuthContext, id: string): Promise<void> {
    await this.visibleRow(auth, id)
    await this.requests.delete(auth.orgId, id)
  }
}
