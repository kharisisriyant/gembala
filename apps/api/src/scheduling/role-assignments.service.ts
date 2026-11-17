import { randomUUID } from "node:crypto"
import { ConflictException, Injectable, NotFoundException } from "@nestjs/common"
import type { RoleAssignmentCreateInput, RoleAssignmentResponse } from "@gembala/shared"
import { members, roleAssignments } from "../db/schema"
import { RoleTemplatesService } from "./role-templates.service"
import { RoleAssignmentsRepository } from "./role-assignments.repository"

type RoleAssignmentRow = typeof roleAssignments.$inferSelect
type MemberRow = typeof members.$inferSelect

export function toAssignmentResponse(row: RoleAssignmentRow, member: Pick<MemberRow, "id" | "name"> | null): RoleAssignmentResponse {
  return {
    id: row.id,
    roleTemplateId: row.roleTemplateId,
    member: member ? { id: member.id, name: member.name } : null,
    freeText: row.freeText,
    sortOrder: row.sortOrder,
    confirmation: {
      status: row.responseStatus,
      respondedAt: row.respondedAt?.toISOString() ?? null,
      declineReason: row.declineReason,
      notifiedAt: row.notifiedAt?.toISOString() ?? null,
    },
  }
}

@Injectable()
export class RoleAssignmentsService {
  constructor(
    private readonly assignments: RoleAssignmentsRepository,
    private readonly roleTemplates: RoleTemplatesService,
  ) {}

  // scopes an instance to the org via its parent event, so nested
  // assignment routes can't reach another org's instance by id
  private async loadInstanceScoped(orgId: string, instanceId: string): Promise<void> {
    const row = await this.assignments.findInstanceInOrg(orgId, instanceId)
    if (!row) throw new NotFoundException("service instance not found")
  }

  private async loadMember(orgId: string, memberId: string): Promise<MemberRow> {
    const row = await this.assignments.findMemberInOrg(orgId, memberId)
    if (!row) throw new NotFoundException("member not found")
    return row
  }

  private async loadAssignmentScoped(orgId: string, assignmentId: string): Promise<RoleAssignmentRow> {
    const row = await this.assignments.findAssignmentInOrg(orgId, assignmentId)
    if (!row) throw new NotFoundException("role assignment not found")
    return row
  }

  private async resolveMember(orgId: string, input: RoleAssignmentCreateInput): Promise<MemberRow | null> {
    const roleTemplate = await this.roleTemplates.detail(orgId, input.roleTemplateId)
    if (!roleTemplate.isActive) throw new ConflictException("role is not active")
    return input.memberId ? this.loadMember(orgId, input.memberId) : null
  }

  async create(
    orgId: string,
    instanceId: string,
    input: RoleAssignmentCreateInput,
  ): Promise<RoleAssignmentResponse> {
    await this.loadInstanceScoped(orgId, instanceId)
    const member = await this.resolveMember(orgId, input)

    const row = await this.assignments.insert({
      serviceInstanceId: instanceId,
      roleTemplateId: input.roleTemplateId,
      memberId: input.memberId ?? null,
      freeText: input.freeText ?? "",
      sortOrder: input.sortOrder,
    })
    return toAssignmentResponse(row, member)
  }

  async update(
    orgId: string,
    assignmentId: string,
    input: RoleAssignmentCreateInput,
  ): Promise<RoleAssignmentResponse> {
    const existing = await this.loadAssignmentScoped(orgId, assignmentId)
    const member = await this.resolveMember(orgId, input)

    const memberId = input.memberId ?? null
    // A different person or a different duty is a new request: the old answer no
    // longer applies and a link already shared must stop working.
    const reassigned = memberId !== existing.memberId || input.roleTemplateId !== existing.roleTemplateId
    const row = await this.assignments.update(existing.id, {
      roleTemplateId: input.roleTemplateId,
      memberId,
      freeText: input.freeText ?? "",
      sortOrder: input.sortOrder,
      ...(reassigned && {
        linkNonce: randomUUID(),
        responseStatus: "pending" as const,
        respondedAt: null,
        declineReason: "",
        notifiedAt: null,
        requestedByUserId: null,
      }),
    })
    return toAssignmentResponse(row, member)
  }

  async remove(orgId: string, assignmentId: string): Promise<void> {
    const existing = await this.loadAssignmentScoped(orgId, assignmentId)
    await this.assignments.delete(existing.id)
  }
}
