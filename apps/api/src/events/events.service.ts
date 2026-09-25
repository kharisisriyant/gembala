import { ConflictException, Injectable, NotFoundException } from "@nestjs/common"
import type { EventCreateInput, EventResponse, EventUpdateInput } from "@gembala/shared"
import { events, rooms } from "../db/schema"
import { EventsRepository } from "./events.repository"

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
  constructor(private readonly events: EventsRepository) {}

  private async loadRoom(orgId: string, roomId: string): Promise<RoomRow> {
    const row = await this.events.findRoomInOrg(orgId, roomId)
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
    const conflict = await this.events.findConflict(orgId, roomId, startAt, endAt, excludeEventId)
    if (conflict) {
      throw new ConflictException(`room already booked for "${conflict.title}" at that time`)
    }
  }

  async list(orgId: string): Promise<EventResponse[]> {
    const rows = await this.events.listWithRoomByOrg(orgId)
    return rows
      .map((r) => toResponse(r.event, r.room))
      .sort((a, b) => a.startAt.localeCompare(b.startAt))
  }

  async detail(orgId: string, id: string): Promise<EventResponse> {
    const row = await this.events.findWithRoomInOrg(orgId, id)
    if (!row) throw new NotFoundException("event not found")
    return toResponse(row.event, row.room)
  }

  async create(orgId: string, input: EventCreateInput): Promise<EventResponse> {
    let room: RoomRow | null = null
    if (input.roomId) {
      room = await this.loadRoom(orgId, input.roomId)
      await this.assertNoConflict(orgId, input.roomId, input.startAt, input.endAt)
    }

    const row = await this.events.insert({
      orgId,
      roomId: input.roomId ?? null,
      title: input.title,
      description: input.description,
      startAt: input.startAt,
      endAt: input.endAt,
      isPublic: input.isPublic,
    })
    return toResponse(row, room)
  }

  async update(orgId: string, id: string, input: EventUpdateInput): Promise<EventResponse> {
    const existing = await this.events.findByIdInOrg(orgId, id)
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

    const row = await this.events.update(orgId, id, {
      roomId,
      startAt,
      endAt,
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.isPublic !== undefined ? { isPublic: input.isPublic } : {}),
    })
    return toResponse(row, room)
  }

  async remove(orgId: string, id: string): Promise<void> {
    const existing = await this.events.findByIdInOrg(orgId, id)
    if (!existing) throw new NotFoundException("event not found")
    await this.events.delete(orgId, id)
  }
}
