import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { organizations, users } from "../auth/auth.schema"

// One Google account per organization. A non-null calendar id means that feed
// is switched on; the calendar was created by this app in the connected account.
export const googleCalendarConnections = pgTable("google_calendar_connections", {
  orgId: uuid("org_id")
    .primaryKey()
    .references(() => organizations.id, { onDelete: "cascade" }),
  connectedBy: uuid("connected_by").references(() => users.id, { onDelete: "set null" }),
  googleEmail: text("google_email").notNull(),
  // AES-256-GCM, see GoogleOAuthService.encrypt
  refreshTokenEnc: text("refresh_token_enc").notNull(),
  eventsCalendarId: text("events_calendar_id"),
  roomsCalendarId: text("rooms_calendar_id"),
  lastError: text("last_error"),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})
