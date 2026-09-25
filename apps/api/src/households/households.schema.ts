import { type AnyPgColumn, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { organizations } from "../auth/auth.schema"
import { members } from "../members/members.schema"

export const households = pgTable(
  "households",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    address: text("address").notNull().default(""),
    primaryContactMemberId: uuid("primary_contact_member_id").references(
      (): AnyPgColumn => members.id,
      {
        onDelete: "set null",
      },
    ),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("households_org_idx").on(t.orgId)],
)
