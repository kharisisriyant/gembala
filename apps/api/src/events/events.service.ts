import { ConflictException, Injectable, NotFoundException } from "@nestjs/common"
import type { EventCreateInput, EventResponse, EventUpdateInput } from "@gembala/shared"
import { and, eq, gt, lt, ne } from "drizzle-orm"
import { InjectDb, type Db } from "../db/drizzle.module"
import { events, rooms } from "../db/schema"

type EventRow = typeof events.$inferSelect
type RoomRow = typeof rooms.$inferSelect

function toResponse(row: EventRow, room: RoomRow | null): EventResponse {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    startAt: row.startAt.toISOString(),
    endAt: row.endAt.toISOString(),
    isPublic: row.isPublic,
    room: room ? { id: room.id, name: room.name } : null,
  }
}

@Injectable()
export class EventsService {
  constructor(@InjectDb() private readonly db: Db) {}

  private async loadRoom(orgId: string, roomId: string): Promise<RoomRow> {
    const [row] = await this.db
      .select()
      .from(rooms)
      .where(and(eq(rooms.id, roomId), eq(rooms.orgId, orgId)))
    if (!row) throw new NotFoundException("room not found")
    return row
  }

  private async assertNoConflict(
    orgId: string,
    roomId: string,
    startAt: Date,
    endAt: Date,
    excludeEventId?: string,
  ): Promise<void> {
    const conflicts = await this.db
      .select({ id: events.id, title: events.title })
      .from(events)
      .where(
        and(
          eq(events.orgId, orgId),
          eq(events.roomId, roomId),
          lt(events.startAt, endAt),
          gt(events.endAt, startAt),
          ...(excludeEventId ? [ne(events.id, excludeEventId)] : []),
        ),
      )
      .limit(1)
    if (conflicts.length > 0) {
      throw new ConflictException(`room already booked for "${conflicts[0].title}" at that time`)
    }
  }

  async list(orgId: string): Promise<EventResponse[]> {
    const rows = await this.db
      .select({ event: events, room: rooms })
      .from(events)
      .leftJoin(rooms, eq(rooms.id, events.roomId))
      .where(eq(events.orgId, orgId))
    return rows
      .map((r) => toResponse(r.event, r.room))
      .sort((a, b) => a.startAt.localeCompare(b.startAt))
  }

  async detail(orgId: string, id: string): Promise<EventResponse> {
    const [row] = await this.db
      .select({ event: events, room: rooms })
      .from(events)
      .leftJoin(rooms, eq(rooms.id, events.roomId))
      .where(and(eq(events.id, id), eq(events.orgId, orgId)))
    if (!row) throw new NotFoundException("event not found")
    return toResponse(row.event, row.room)
  }

  async create(orgId: string, input: EventCreateInput): Promise<EventResponse> {
    let room: RoomRow | null = null
    if (input.roomId) {
      room = await this.loadRoom(orgId, input.roomId)
      await this.assertNoConflict(orgId, input.roomId, input.startAt, input.endAt)
    }

    const [row] = await this.db
      .insert(events)
      .values({
        orgId,
        roomId: input.roomId ?? null,
        title: input.title,
        description: input.description,
        startAt: input.startAt,
        endAt: input.endAt,
        isPublic: input.isPublic,
      })
      .returning()
    return toResponse(row, room)
  }

  async update(orgId: string, id: string, input: EventUpdateInput): Promise<EventResponse> {
    const [existing] = await this.db
      .select()
      .from(events)
      .where(and(eq(events.id, id), eq(events.orgId, orgId)))
    if (!existing) throw new NotFoundException("event not found")

    const roomId = input.roomId !== undefined ? input.roomId : existing.roomId
    const startAt = input.startAt ?? existing.startAt
    const endAt = input.endAt ?? existing.endAt
    if (endAt <= startAt) throw new ConflictException("end must be after start")

    let room: RoomRow | null = null
    if (roomId) {
      room = await this.loadRoom(orgId, roomId)
      await this.assertNoConflict(orgId, roomId, startAt, endAt, id)
    }

    const [row] = await this.db
      .update(events)
      .set({
        roomId,
        startAt,
        endAt,
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.isPublic !== undefined ? { isPublic: input.isPublic } : {}),
      })
      .where(and(eq(events.id, id), eq(events.orgId, orgId)))
      .returning()
    return toResponse(row, room)
  }

  async remove(orgId: string, id: string): Promise<void> {
    const [existing] = await this.db
      .select({ id: events.id })
      .from(events)
      .where(and(eq(events.id, id), eq(events.orgId, orgId)))
    if (!existing) throw new NotFoundException("event not found")
    await this.db.delete(events).where(and(eq(events.id, id), eq(events.orgId, orgId)))
  }
}
