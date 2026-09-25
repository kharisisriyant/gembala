import { date, index, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { organizations } from "../auth/auth.schema"
import { members } from "../members/members.schema"
import { tags } from "../tags/tags.schema"

export const groups = pgTable(
  "groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    leaderMemberId: uuid("leader_member_id")
      .notNull()
      .references(() => members.id, { onDelete: "restrict" }),
    scopeTagId: uuid("scope_tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "restrict" }),
    schedule: text("schedule").notNull().default(""),
    location: text("location").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("groups_org_idx").on(t.orgId)],
)

export const groupMembers = pgTable(
  "group_members",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.memberId] })],
)

export const attendanceSessions = pgTable(
  "attendance_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    topic: text("topic").notNull().default(""),
    prayerNotes: text("prayer_notes").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("attendance_sessions_group_idx").on(t.groupId)],
)

export const sessionAttendance = pgTable(
  "session_attendance",
  {
    sessionId: uuid("session_id")
      .notNull()
      .references(() => attendanceSessions.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.sessionId, t.memberId] })],
)
