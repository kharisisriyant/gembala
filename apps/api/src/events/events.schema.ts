import { boolean, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { organizations } from "../auth/auth.schema"
import { rooms } from "../rooms/rooms.schema"

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    roomId: uuid("room_id").references(() => rooms.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    isPublic: boolean("is_public").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("events_org_idx").on(t.orgId),
    index("events_room_idx").on(t.roomId),
    index("events_start_idx").on(t.startAt),
  ],
)
