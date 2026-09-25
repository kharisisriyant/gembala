import { Injectable } from "@nestjs/common"
import { and, eq, gt, lt, ne } from "drizzle-orm"
import { InjectDb, type Db, type Tx } from "../db/drizzle.module"
import { events, rooms } from "../db/schema"

export type EventInsert = typeof events.$inferInsert
export type EventPatch = Partial<typeof events.$inferInsert>

@Injectable()
export class EventsRepository {
  constructor(@InjectDb() private readonly db: Db) {}

  async findRoomInOrg(orgId: string, roomId: string, tx: Db | Tx = this.db) {
    const [row] = await tx
      .select()
      .from(rooms)
      .where(and(eq(rooms.id, roomId), eq(rooms.orgId, orgId)))
    return row
  }

  async findConflict(
    orgId: string,
    roomId: string,
    startAt: Date,
    endAt: Date,
    excludeEventId: string | undefined,
    tx: Db | Tx = this.db,
  ) {
    const [row] = await tx
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
    return row
  }

  async listWithRoomByOrg(orgId: string, tx: Db | Tx = this.db) {
    return tx
      .select({ event: events, room: rooms })
      .from(events)
      .leftJoin(rooms, eq(rooms.id, events.roomId))
      .where(eq(events.orgId, orgId))
  }

  async findWithRoomInOrg(orgId: string, id: string, tx: Db | Tx = this.db) {
    const [row] = await tx
      .select({ event: events, room: rooms })
      .from(events)
      .leftJoin(rooms, eq(rooms.id, events.roomId))
      .where(and(eq(events.id, id), eq(events.orgId, orgId)))
    return row
  }

  async findByIdInOrg(orgId: string, id: string, tx: Db | Tx = this.db) {
    const [row] = await tx.select().from(events).where(and(eq(events.id, id), eq(events.orgId, orgId)))
    return row
  }

  async insert(input: EventInsert, tx: Db | Tx = this.db) {
    const [row] = await tx.insert(events).values(input).returning()
    return row
  }

  async update(orgId: string, id: string, patch: EventPatch, tx: Db | Tx = this.db) {
    const [row] = await tx
      .update(events)
      .set(patch)
      .where(and(eq(events.id, id), eq(events.orgId, orgId)))
      .returning()
    return row
  }

  async delete(orgId: string, id: string, tx: Db | Tx = this.db) {
    await tx.delete(events).where(and(eq(events.id, id), eq(events.orgId, orgId)))
  }
}
