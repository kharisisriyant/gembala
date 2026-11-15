import { index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { organizations, users } from "../auth/auth.schema"
import { members } from "../members/members.schema"

export const pastoralNoteSource = pgEnum("pastoral_note_source", ["web", "telegram"])

// Private notes a leader keeps about a member. Visible only to the author and
// org admins; never surfaced in member responses, dashboard, digest or search.
export const pastoralNotes = pgTable(
  "pastoral_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    // Null once the author's user is deleted: the note survives, admin-visible only.
    authorUserId: uuid("author_user_id").references(() => users.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    source: pastoralNoteSource("source").notNull().default("web"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("pastoral_notes_org_member_idx").on(t.orgId, t.memberId)],
)
