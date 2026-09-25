import { type AnyPgColumn, index, pgTable, primaryKey, text, uniqueIndex, uuid } from "drizzle-orm/pg-core"
import { organizations, orgMemberships } from "../auth/auth.schema"

export const tags = pgTable(
  "tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    parentId: uuid("parent_id").references((): AnyPgColumn => tags.id),
    description: text("description"),
  },
  (t) => [uniqueIndex("tags_org_name_uq").on(t.orgId, t.name), index("tags_org_idx").on(t.orgId)],
)

export const membershipScopeTags = pgTable(
  "membership_scope_tags",
  {
    membershipId: uuid("membership_id")
      .notNull()
      .references(() => orgMemberships.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.membershipId, t.tagId] })],
)
