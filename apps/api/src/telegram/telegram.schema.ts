import { pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core"
import { index } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { users } from "../auth/auth.schema"

export const telegramLinkCodes = pgTable(
  "telegram_link_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    code: text("code").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("telegram_link_codes_user_idx").on(t.userId)],
)

export const telegramLinks = pgTable(
  "telegram_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    telegramChatId: text("telegram_chat_id").notNull(),
    telegramUsername: text("telegram_username"),
    linkedAt: timestamp("linked_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("telegram_links_user_active_uq").on(t.userId).where(sql`revoked_at is null`),
    uniqueIndex("telegram_links_chat_active_uq").on(t.telegramChatId).where(sql`revoked_at is null`),
  ],
)
