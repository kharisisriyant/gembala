import { Injectable } from "@nestjs/common"
import { and, eq } from "drizzle-orm"
import { InjectDb, type Db, type Tx } from "../db/drizzle.module"
import { rooms } from "../db/schema"

export type RoomInsert = typeof rooms.$inferInsert
export type RoomPatch = Partial<typeof rooms.$inferInsert>

@Injectable()
export class RoomsRepository {
  constructor(@InjectDb() private readonly db: Db) {}

  async listByOrg(orgId: string, tx: Db | Tx = this.db) {
    return tx.select().from(rooms).where(eq(rooms.orgId, orgId))
  }

  async findByIdInOrg(orgId: string, id: string, tx: Db | Tx = this.db) {
    const [row] = await tx
      .select()
      .from(rooms)
      .where(and(eq(rooms.id, id), eq(rooms.orgId, orgId)))
    return row
  }

  async insert(orgId: string, input: RoomInsert, tx: Db | Tx = this.db) {
    const [row] = await tx
      .insert(rooms)
      .values({ ...input, orgId })
      .returning()
    return row
  }

  async update(orgId: string, id: string, patch: RoomPatch, tx: Db | Tx = this.db) {
    const [row] = await tx
      .update(rooms)
      .set(patch)
      .where(and(eq(rooms.id, id), eq(rooms.orgId, orgId)))
      .returning()
    return row
  }

  async delete(orgId: string, id: string, tx: Db | Tx = this.db) {
    await tx.delete(rooms).where(and(eq(rooms.id, id), eq(rooms.orgId, orgId)))
  }
}
