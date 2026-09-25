import { Injectable, NotFoundException } from "@nestjs/common"
import type { RoomCreateInput, RoomResponse, RoomUpdateInput } from "@gembala/shared"
import { and, eq } from "drizzle-orm"
import { InjectDb, type Db } from "../db/drizzle.module"
import { rooms } from "../db/schema"

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
  constructor(@InjectDb() private readonly db: Db) {}

  async list(orgId: string): Promise<RoomResponse[]> {
    const rows = await this.db.select().from(rooms).where(eq(rooms.orgId, orgId))
    return rows.map(toResponse).sort((a, b) => a.name.localeCompare(b.name))
  }

  async detail(orgId: string, id: string): Promise<RoomResponse> {
    const [row] = await this.db
      .select()
      .from(rooms)
      .where(and(eq(rooms.id, id), eq(rooms.orgId, orgId)))
    if (!row) throw new NotFoundException("room not found")
    return toResponse(row)
  }

  async create(orgId: string, input: RoomCreateInput): Promise<RoomResponse> {
    const [row] = await this.db
      .insert(rooms)
      .values({
        orgId,
        name: input.name,
        capacity: input.capacity ?? null,
        description: input.description,
        isActive: input.isActive,
      })
      .returning()
    return toResponse(row)
  }

  async update(orgId: string, id: string, input: RoomUpdateInput): Promise<RoomResponse> {
    await this.detail(orgId, id)

    const patch: Partial<typeof rooms.$inferInsert> = {}
    if (input.name !== undefined) patch.name = input.name
    if (input.capacity !== undefined) patch.capacity = input.capacity
    if (input.description !== undefined) patch.description = input.description
    if (input.isActive !== undefined) patch.isActive = input.isActive

    const [row] = await this.db
      .update(rooms)
      .set(patch)
      .where(and(eq(rooms.id, id), eq(rooms.orgId, orgId)))
      .returning()
    return toResponse(row)
  }

  async remove(orgId: string, id: string): Promise<void> {
    await this.detail(orgId, id)
    await this.db.delete(rooms).where(and(eq(rooms.id, id), eq(rooms.orgId, orgId)))
  }
}
