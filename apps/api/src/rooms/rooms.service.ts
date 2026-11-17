import { Injectable, NotFoundException } from "@nestjs/common"
import type { RoomCreateInput, RoomResponse, RoomUpdateInput } from "@gembala/shared"
import { rooms } from "../db/schema"
import { GoogleCalendarService } from "../google/google-calendar.service"
import { RoomsRepository } from "./rooms.repository"

function toResponse(row: typeof rooms.$inferSelect): RoomResponse {
  return {
    id: row.id,
    name: row.name,
    capacity: row.capacity,
    description: row.description,
    isActive: row.isActive,
  }
}

@Injectable()
export class RoomsService {
  constructor(private readonly rooms: RoomsRepository, private readonly googleCalendar: GoogleCalendarService) {}

  async list(orgId: string): Promise<RoomResponse[]> {
    const rows = await this.rooms.listByOrg(orgId)
    return rows.map(toResponse).sort((a, b) => a.name.localeCompare(b.name))
  }

  async detail(orgId: string, id: string): Promise<RoomResponse> {
    const row = await this.rooms.findByIdInOrg(orgId, id)
    if (!row) throw new NotFoundException("room not found")
    return toResponse(row)
  }

  async create(orgId: string, input: RoomCreateInput): Promise<RoomResponse> {
    const row = await this.rooms.insert(orgId, {
      orgId,
      name: input.name,
      capacity: input.capacity ?? null,
      description: input.description,
      isActive: input.isActive,
    })
    return toResponse(row)
  }

  async update(orgId: string, id: string, input: RoomUpdateInput): Promise<RoomResponse> {
    await this.detail(orgId, id)

    const patch: Partial<typeof rooms.$inferInsert> = {}
    if (input.name !== undefined) patch.name = input.name
    if (input.capacity !== undefined) patch.capacity = input.capacity
    if (input.description !== undefined) patch.description = input.description
    if (input.isActive !== undefined) patch.isActive = input.isActive

    const row = await this.rooms.update(orgId, id, patch)
    // Room names appear in synced Google events.
    if (input.name !== undefined) this.googleCalendar.orgChanged(orgId)
    return toResponse(row)
  }

  async remove(orgId: string, id: string): Promise<void> {
    await this.detail(orgId, id)
    await this.rooms.delete(orgId, id)
    this.googleCalendar.orgChanged(orgId)
  }
}
