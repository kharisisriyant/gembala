import { index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { organizations, users } from "../auth/auth.schema"
import { members } from "../members/members.schema"

export const careRequestType = pgEnum("care_request_type", ["prayer", "care"])
export const careRequestStatus = pgEnum("care_request_status", ["open", "closed"])
export const careRequestSource = pgEnum("care_request_source", ["leader", "member"])

export const careRequests = pgTable(
  "care_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    type: careRequestType("type").notNull(),
    body: text("body").notNull(),
    status: careRequestStatus("status").notNull().default("open"),
    source: careRequestSource("source").notNull(),
    // null when source = member (member self-submit has no user login)
    submittedByUserId: uuid("submitted_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    closedByUserId: uuid("closed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    closeNote: text("close_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("care_requests_org_status_idx").on(t.orgId, t.status),
    index("care_requests_member_idx").on(t.memberId),
  ],
)
