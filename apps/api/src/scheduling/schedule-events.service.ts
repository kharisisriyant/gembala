import { Injectable, NotFoundException } from "@nestjs/common"
import type {
  RoleAssignmentResponse,
  ScheduleEventCreateInput,
  ScheduleEventDetailResponse,
  ScheduleEventResponse,
  ScheduleEventUpdateInput,
  ServiceInstanceResponse,
} from "@gembala/shared"
import { and, eq, inArray } from "drizzle-orm"
import { InjectDb, type Db } from "../db/drizzle.module"
import {
  instanceTypes,
  members,
  roleAssignments,
  scheduleEvents,
  serviceInstances,
} from "../db/schema"

type EventRow = typeof scheduleEvents.$inferSelect

function toEventResponse(row: EventRow): ScheduleEventResponse {
  return {
    id: row.id,
    date: row.date,
    scriptureRef: row.scriptureRef,
    theme: row.theme,
  }
}

@Injectable()
export class ScheduleEventsService {
  constructor(@InjectDb() private readonly db: Db) {}

  private async loadEvent(orgId: string, id: string): Promise<EventRow> {
    const [row] = await this.db
      .select()
      .from(scheduleEvents)
      .where(and(eq(scheduleEvents.id, id), eq(scheduleEvents.orgId, orgId)))
    if (!row) throw new NotFoundException("schedule event not found")
    return row
  }

  // batch-loads instances + assignments for a set of events, avoiding N+1
  // queries when rendering the full roster grid
  private async attachDetail(events: EventRow[]): Promise<ScheduleEventDetailResponse[]> {
    if (events.length === 0) return []
    const eventIds = events.map((e) => e.id)

    const instanceRows = await this.db
      .select({ instance: serviceInstances, instanceType: instanceTypes })
      .from(serviceInstances)
      .innerJoin(instanceTypes, eq(instanceTypes.id, serviceInstances.instanceTypeId))
      .where(inArray(serviceInstances.eventId, eventIds))

    const instanceIds = instanceRows.map((r) => r.instance.id)
    const assignmentRows = instanceIds.length
      ? await this.db
          .select({ assignment: roleAssignments, member: members })
          .from(roleAssignments)
          .leftJoin(members, eq(members.id, roleAssignments.memberId))
          .where(inArray(roleAssignments.serviceInstanceId, instanceIds))
      : []

    const assignmentsByInstance = new Map<string, RoleAssignmentResponse[]>()
    for (const { assignment, member } of assignmentRows) {
      const list = assignmentsByInstance.get(assignment.serviceInstanceId) ?? []
      list.push({
        id: assignment.id,
        roleTemplateId: assignment.roleTemplateId,
        member: member ? { id: member.id, name: member.name } : null,
        freeText: assignment.freeText,
        sortOrder: assignment.sortOrder,
      })
      assignmentsByInstance.set(assignment.serviceInstanceId, list)
    }

    const instancesByEvent = new Map<string, (ServiceInstanceResponse & { assignments: RoleAssignmentResponse[] })[]>()
    for (const { instance, instanceType } of instanceRows) {
      const list = instancesByEvent.get(instance.eventId) ?? []
      list.push({
        id: instance.id,
        eventId: instance.eventId,
        instanceType: { id: instanceType.id, name: instanceType.name },
        sortOrder: instance.sortOrder,
        assignments: (assignmentsByInstance.get(instance.id) ?? []).sort(
          (a, b) => a.sortOrder - b.sortOrder,
        ),
      })
      instancesByEvent.set(instance.eventId, list)
    }

    return events.map((event) => ({
      ...toEventResponse(event),
      instances: (instancesByEvent.get(event.id) ?? []).sort((a, b) => a.sortOrder - b.sortOrder),
    }))
  }

  async list(orgId: string): Promise<ScheduleEventDetailResponse[]> {
    const rows = await this.db.select().from(scheduleEvents).where(eq(scheduleEvents.orgId, orgId))
    const detailed = await this.attachDetail(rows)
    return detailed.sort((a, b) => a.date.localeCompare(b.date))
  }

  async detail(orgId: string, id: string): Promise<ScheduleEventDetailResponse> {
    const row = await this.loadEvent(orgId, id)
    const [detailed] = await this.attachDetail([row])
    return detailed
  }

  async create(orgId: string, input: ScheduleEventCreateInput): Promise<ScheduleEventDetailResponse> {
    const [row] = await this.db
      .insert(scheduleEvents)
      .values({ orgId, date: input.date, scriptureRef: input.scriptureRef, theme: input.theme })
      .returning()
    const [detailed] = await this.attachDetail([row])
    return detailed
  }

  async update(
    orgId: string,
    id: string,
    input: ScheduleEventUpdateInput,
  ): Promise<ScheduleEventDetailResponse> {
    await this.loadEvent(orgId, id)

    const patch: Partial<typeof scheduleEvents.$inferInsert> = {}
    if (input.date !== undefined) patch.date = input.date
    if (input.scriptureRef !== undefined) patch.scriptureRef = input.scriptureRef
    if (input.theme !== undefined) patch.theme = input.theme

    const [row] = await this.db
      .update(scheduleEvents)
      .set(patch)
      .where(and(eq(scheduleEvents.id, id), eq(scheduleEvents.orgId, orgId)))
      .returning()
    const [detailed] = await this.attachDetail([row])
    return detailed
  }

  async remove(orgId: string, id: string): Promise<void> {
    await this.loadEvent(orgId, id)
    await this.db.delete(scheduleEvents).where(and(eq(scheduleEvents.id, id), eq(scheduleEvents.orgId, orgId)))
  }
}
