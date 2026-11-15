import { Injectable } from "@nestjs/common"
import { and, eq, gte } from "drizzle-orm"
import { InjectDb, type Db } from "../db/drizzle.module"
import { events, googleCalendarConnections, organizations, rooms } from "../db/schema"

export type GoogleCalendarConnection = typeof googleCalendarConnections.$inferSelect
export type GoogleCalendarConnectionPatch = Partial<Omit<typeof googleCalendarConnections.$inferInsert, "orgId">>

@Injectable()
export class GoogleCalendarRepository {
  constructor(@InjectDb() private readonly db: Db) {}

  async findByOrg(orgId: string) {
    const [row] = await this.db.select().from(googleCalendarConnections).where(eq(googleCalendarConnections.orgId, orgId))
    return row
  }

  async listAll() {
    return this.db.select().from(googleCalendarConnections)
  }

  async upsert(input: typeof googleCalendarConnections.$inferInsert) {
    const { orgId, ...rest } = input
    const [row] = await this.db
      .insert(googleCalendarConnections)
      .values(input)
      .onConflictDoUpdate({ target: googleCalendarConnections.orgId, set: rest })
      .returning()
    return row
  }

  async update(orgId: string, patch: GoogleCalendarConnectionPatch) {
    const [row] = await this.db
      .update(googleCalendarConnections)
      .set(patch)
      .where(eq(googleCalendarConnections.orgId, orgId))
      .returning()
    return row
  }

  async delete(orgId: string) {
    await this.db.delete(googleCalendarConnections).where(eq(googleCalendarConnections.orgId, orgId))
  }

  async orgName(orgId: string) {
    const [row] = await this.db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, orgId))
    return row?.name
  }

  async eventWithRoom(orgId: string, eventId: string) {
    const [row] = await this.db
      .select({ event: events, room: rooms })
      .from(events)
      .leftJoin(rooms, eq(rooms.id, events.roomId))
      .where(and(eq(events.id, eventId), eq(events.orgId, orgId)))
    return row
  }

  async eventsWithRoomEndingAfter(orgId: string, cutoff: Date) {
    return this.db
      .select({ event: events, room: rooms })
      .from(events)
      .leftJoin(rooms, eq(rooms.id, events.roomId))
      .where(and(eq(events.orgId, orgId), gte(events.endAt, cutoff)))
  }
}
