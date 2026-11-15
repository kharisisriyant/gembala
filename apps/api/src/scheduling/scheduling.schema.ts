import { boolean, date, index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core"
import { rosterResponseStatuses } from "@gembala/shared"
import { organizations, users } from "../auth/auth.schema"
import { members } from "../members/members.schema"

export const rosterResponseStatus = pgEnum("roster_response_status", rosterResponseStatuses)

export const instanceTypes = pgTable(
  "instance_types",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("instance_types_org_name_uq").on(t.orgId, t.name),
    index("instance_types_org_idx").on(t.orgId),
  ],
)

export const roleTemplates = pgTable(
  "role_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("role_templates_org_name_uq").on(t.orgId, t.name),
    index("role_templates_org_idx").on(t.orgId),
  ],
)

export const scheduleEvents = pgTable(
  "schedule_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    scriptureRef: text("scripture_ref").notNull().default(""),
    theme: text("theme").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("schedule_events_org_idx").on(t.orgId),
    index("schedule_events_date_idx").on(t.date),
  ],
)

export const serviceInstances = pgTable(
  "service_instances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => scheduleEvents.id, { onDelete: "cascade" }),
    instanceTypeId: uuid("instance_type_id")
      .notNull()
      .references(() => instanceTypes.id, { onDelete: "restrict" }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    uniqueIndex("service_instances_event_type_uq").on(t.eventId, t.instanceTypeId),
    index("service_instances_event_idx").on(t.eventId),
  ],
)

export const roleAssignments = pgTable(
  "role_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    serviceInstanceId: uuid("service_instance_id")
      .notNull()
      .references(() => serviceInstances.id, { onDelete: "cascade" }),
    roleTemplateId: uuid("role_template_id")
      .notNull()
      .references(() => roleTemplates.id, { onDelete: "restrict" }),
    memberId: uuid("member_id").references(() => members.id, { onDelete: "set null" }),
    freeText: text("free_text").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
    // Volunteer confirmation. The public link is HMAC(assignment id, link nonce);
    // a new nonce (on member or role change) invalidates links already shared.
    linkNonce: uuid("link_nonce").notNull().defaultRandom(),
    responseStatus: rosterResponseStatus("response_status").notNull().default("pending"),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    declineReason: text("decline_reason").notNull().default(""),
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
    // The leader who last shared or sent the link; told in-app when the member declines.
    requestedByUserId: uuid("requested_by_user_id").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [
    index("role_assignments_instance_idx").on(t.serviceInstanceId),
    index("role_assignments_role_idx").on(t.roleTemplateId),
    index("role_assignments_member_idx").on(t.memberId),
  ],
)
