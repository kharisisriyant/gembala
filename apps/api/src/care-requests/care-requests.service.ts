import { ConflictException, Injectable, NotFoundException } from "@nestjs/common"
import type {
  CareRequestCloseInput,
  CareRequestCreateInput,
  CareRequestResponse,
  CareRequestUpdateInput,
} from "@gembala/shared"
import { ScopeService } from "../authz/scope.service"
import type { AuthContext } from "../authz/auth-context"
import {
  CareRequestsRepository,
  type CareRequestFilters,
  type CareRequestRow,
} from "./care-requests.repository"

// Who filed the request. `member` is reserved for the future member-facing
// endpoint; v1 only ever passes `leader`.
export type CareRequestSubmitter =
  | { source: "leader"; userId: string }
  | { source: "member"; memberId: string }

@Injectable()
export class CareRequestsService {
  constructor(
    private readonly requests: CareRequestsRepository,
    private readonly scope: ScopeService,
  ) {}

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

  async list(auth: AuthContext, filters: CareRequestFilters): Promise<CareRequestResponse[]> {
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
    const member = await this.requests.findMember(auth.orgId, input.memberId)
    const scope = await this.scope.expandedScope(auth)
    const tagRows = member ? await this.requests.tagNamesByMemberIds([member.id]) : []
    if (!member || !this.scope.memberVisible(scope, tagRows.map((t) => t.name))) {
      throw new NotFoundException("member not found")
    }
    return this.insert(auth.orgId, input, { source: "leader", userId: auth.userId })
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
    })
    const row = await this.requests.findById(orgId, id)
    return this.toResponse(row!)
  }

  async update(auth: AuthContext, id: string, input: CareRequestUpdateInput): Promise<CareRequestResponse> {
    const row = await this.visibleRow(auth, id)
    if (row.status === "closed") throw new ConflictException("closed requests cannot be edited; reopen first")
    await this.requests.update(auth.orgId, id, { type: input.type, body: input.body })
    return this.get(auth, id)
  }

  async close(auth: AuthContext, id: string, input: CareRequestCloseInput): Promise<CareRequestResponse> {
    const row = await this.visibleRow(auth, id)
    if (row.status === "closed") throw new ConflictException("request is already closed")
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
    if (row.status === "open") throw new ConflictException("request is already open")
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
