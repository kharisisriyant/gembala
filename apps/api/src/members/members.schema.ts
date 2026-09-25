import {
  type AnyPgColumn,
  date,
  index,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"
import { organizations } from "../auth/auth.schema"
import { tags } from "../tags/tags.schema"
import { households } from "../households/households.schema"

export const memberStatus = pgEnum("member_status", ["active", "newcomer", "inactive", "moved"])
export const memberGender = pgEnum("member_gender", ["male", "female"])
export const memberMaritalStatus = pgEnum("member_marital_status", [
  "single",
  "married",
  "widowed",
  "divorced",
])
export const memberBaptismStatus = pgEnum("member_baptism_status", ["not_baptized", "baptized"])
export const memberRelationshipType = pgEnum("member_relationship_type", [
  "spouse",
  "parent_of",
  "sibling_of",
  "guardian_of",
  "grandparent_of",
  "other",
])

export const members = pgTable(
  "members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email").notNull().default(""),
    phone: text("phone").notNull().default(""),
    status: memberStatus("status").notNull().default("active"),
    joinedAt: date("joined_at").notNull(),
    dateOfBirth: date("date_of_birth"),
    gender: memberGender("gender"),
    maritalStatus: memberMaritalStatus("marital_status"),
    address: text("address").notNull().default(""),
    occupation: text("occupation").notNull().default(""),
    notes: text("notes").notNull().default(""),
    photoUrl: text("photo_url").notNull().default(""),
    baptismStatus: memberBaptismStatus("baptism_status"),
    baptismDate: date("baptism_date"),
    householdId: uuid("household_id").references((): AnyPgColumn => households.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("members_org_idx").on(t.orgId), index("members_household_idx").on(t.householdId)],
)

export const memberTags = pgTable(
  "member_tags",
  {
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.memberId, t.tagId] })],
)

export const memberRelationships = pgTable(
  "member_relationships",
  {
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    relatedMemberId: uuid("related_member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    relationType: memberRelationshipType("relation_type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.memberId, t.relatedMemberId, t.relationType] }),
    index("member_relationships_related_idx").on(t.relatedMemberId),
  ],
)
