import { boolean, date, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core"
import { users } from "../auth/auth.schema"

// No row = defaults (enabled, Indonesian). Created lazily on first save.
export const digestPreferences = pgTable("digest_preferences", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  enabled: boolean("enabled").notNull().default(true),
  locale: text("locale").notNull().default("id"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export const digestStatus = pgEnum("digest_status", ["pending", "sent", "failed"])
export const digestChannel = pgEnum("digest_channel", ["telegram", "email"])

// One row per (user, week): the claim that makes the weekly send idempotent
// across restarts and multiple API instances.
export const digestLog = pgTable(
  "digest_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    weekStart: date("week_start").notNull(),
    status: digestStatus("status").notNull().default("pending"),
    channel: digestChannel("channel"),
    error: text("error"),
    attemptedAt: timestamp("attempted_at", { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("digest_log_user_week_uq").on(t.userId, t.weekStart)],
)
