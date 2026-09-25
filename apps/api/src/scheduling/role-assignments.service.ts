import { ConflictException, Injectable, NotFoundException } from "@nestjs/common"
import type { RoleAssignmentCreateInput, RoleAssignmentResponse } from "@gembala/shared"
import { and, eq } from "drizzle-orm"
import { InjectDb, type Db } from "../db/drizzle.module"
import { members, roleAssignments, scheduleEvents, serviceInstances } from "../db/schema"
import { RoleTemplatesService } from "./role-templates.service"

type RoleAssignmentRow = typeof roleAssignments.$inferSelect
type MemberRow = typeof members.$inferSelect

function toResponse(row: RoleAssignmentRow, member: MemberRow | null): RoleAssignmentResponse {
  return {
    id: row.id,
    roleTemplateId: row.roleTemplateId,
    member: member ? { id: member.id, name: member.name } : null,
    freeText: row.freeText,
    sortOrder: row.sortOrder,
  }
}

@Injectable()
export class RoleAssignmentsService {
  constructor(
    @InjectDb() private readonly db: Db,
    private readonly roleTemplates: RoleTemplatesService,
  ) {}

  // scopes an instance to the org via its parent event, so nested
  // assignment routes can't reach another org's instance by id
  private async loadInstanceScoped(orgId: string, instanceId: string): Promise<void> {
    const [row] = await this.db
      .select({ id: serviceInstances.id })
      .from(serviceInstances)
      .innerJoin(scheduleEvents, eq(scheduleEvents.id, serviceInstances.eventId))
      .where(and(eq(serviceInstances.id, instanceId), eq(scheduleEvents.orgId, orgId)))
    if (!row) throw new NotFoundException("service instance not found")
  }

  private async loadMember(orgId: string, memberId: string): Promise<MemberRow> {
    const [row] = await this.db
      .select()
      .from(members)
      .where(and(eq(members.id, memberId), eq(members.orgId, orgId)))
    if (!row) throw new NotFoundException("member not found")
    return row
  }

  private async loadAssignmentScoped(orgId: string, assignmentId: string): Promise<RoleAssignmentRow> {
    const [row] = await this.db
      .select({ assignment: roleAssignments })
      .from(roleAssignments)
      .innerJoin(serviceInstances, eq(serviceInstances.id, roleAssignments.serviceInstanceId))
      .innerJoin(scheduleEvents, eq(scheduleEvents.id, serviceInstances.eventId))
      .where(and(eq(roleAssignments.id, assignmentId), eq(scheduleEvents.orgId, orgId)))
    if (!row) throw new NotFoundException("role assignment not found")
    return row.assignment
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

    const [row] = await this.db
      .insert(roleAssignments)
      .values({
        serviceInstanceId: instanceId,
        roleTemplateId: input.roleTemplateId,
        memberId: input.memberId ?? null,
        freeText: input.freeText ?? "",
        sortOrder: input.sortOrder,
      })
      .returning()
    return toResponse(row, member)
  }

  async update(
    orgId: string,
    assignmentId: string,
    input: RoleAssignmentCreateInput,
  ): Promise<RoleAssignmentResponse> {
    const existing = await this.loadAssignmentScoped(orgId, assignmentId)
    const member = await this.resolveMember(orgId, input)

    const [row] = await this.db
      .update(roleAssignments)
      .set({
        roleTemplateId: input.roleTemplateId,
        memberId: input.memberId ?? null,
        freeText: input.freeText ?? "",
        sortOrder: input.sortOrder,
      })
      .where(eq(roleAssignments.id, existing.id))
      .returning()
    return toResponse(row, member)
  }

  async remove(orgId: string, assignmentId: string): Promise<void> {
    const existing = await this.loadAssignmentScoped(orgId, assignmentId)
    await this.db.delete(roleAssignments).where(eq(roleAssignments.id, existing.id))
  }
}
