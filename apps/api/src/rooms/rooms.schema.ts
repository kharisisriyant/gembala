import { boolean, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { organizations } from "../auth/auth.schema"

export const rooms = pgTable(
  "rooms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    capacity: integer("capacity"),
    description: text("description").notNull().default(""),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("rooms_org_idx").on(t.orgId)],
)
