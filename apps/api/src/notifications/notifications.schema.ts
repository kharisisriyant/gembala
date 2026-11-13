import { boolean, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { organizations, users } from "../auth/auth.schema"
import {
  DELIVERY_STATUSES,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_PRIORITIES,
  SKIP_REASONS,
} from "@gembala/shared"

export const notificationChannel = pgEnum("notification_channel", NOTIFICATION_CHANNELS)
export const notificationCategory = pgEnum("notification_category", NOTIFICATION_CATEGORIES)
export const notificationPriority = pgEnum("notification_priority", NOTIFICATION_PRIORITIES)
export const deliveryStatus = pgEnum("notification_delivery_status", DELIVERY_STATUSES)
export const deliverySkipReason = pgEnum("notification_skip_reason", SKIP_REASONS)

// Accepted producer events. Doubles as the transactional outbox: `processedAt`
// is null until the router has expanded the event into notifications.
export const notificationEvents = pgTable(
  "notification_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    typeKey: text("type_key").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    recipientUserIds: jsonb("recipient_user_ids").$type<string[]>().notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    sendAt: timestamp("send_at", { withTimezone: true }),
    correlationId: uuid("correlation_id").notNull().defaultRandom(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("notification_events_idempotency_uq").on(t.idempotencyKey),
    index("notification_events_unprocessed_idx").on(t.createdAt).where(sql`${t.processedAt} is null`),
  ],
)

// One instance of a type for one recipient. Title/body are rendered at creation
// in the recipient's locale and stored, so later locale changes don't rewrite history.
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id").notNull().references(() => notificationEvents.id, { onDelete: "cascade" }),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    typeKey: text("type_key").notNull(),
    category: notificationCategory("category").notNull(),
    priority: notificationPriority("priority").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    link: text("link"),
    collapseKey: text("collapse_key"), // reserved for phase 2
    readAt: timestamp("read_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    correlationId: uuid("correlation_id").notNull(),
    // Millisecond precision so the inbox cursor (a JS Date) compares exactly.
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("notifications_event_user_uq").on(t.eventId, t.userId),
    index("notifications_user_org_created_idx").on(t.userId, t.orgId, t.createdAt),
    index("notifications_unread_idx").on(t.userId, t.orgId).where(sql`${t.readAt} is null`),
  ],
)

export const notificationDeliveries = pgTable(
  "notification_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    notificationId: uuid("notification_id").notNull().references(() => notifications.id, { onDelete: "cascade" }),
    channel: notificationChannel("channel").notNull(),
    status: deliveryStatus("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    providerMessageId: text("provider_message_id"),
    errorCode: text("error_code"),
    skipReason: deliverySkipReason("skip_reason"),
    sendAt: timestamp("send_at", { withTimezone: true }),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }), // reserved for phase 2
    correlationId: uuid("correlation_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("notification_deliveries_notification_channel_uq").on(t.notificationId, t.channel),
    index("notification_deliveries_open_idx").on(t.status, t.updatedAt).where(sql`${t.status} in ('pending','queued')`),
  ],
)

// Overrides only; absent row = catalog/category default.
export const userNotificationPreferences = pgTable(
  "user_notification_preferences",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    category: notificationCategory("category").notNull(),
    channel: notificationChannel("channel").notNull(),
    enabled: boolean("enabled").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("user_notification_preferences_uq").on(t.userId, t.category, t.channel)],
)

export const notificationKillSwitches = pgTable("notification_kill_switches", {
  id: uuid("id").primaryKey().defaultRandom(),
  typeKey: text("type_key"),
  channel: notificationChannel("channel"),
  reason: text("reason").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})
