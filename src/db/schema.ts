import {
  pgTable,
  uuid,
  text,
  timestamp,
  date,
  time,
  integer,
  pgEnum,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";

// Enums
export const roleEnum = pgEnum("role", [
  "super_admin",
  "admin",
  "zone_leader",
  "cell_leader",
]);
export const genderEnum = pgEnum("gender", ["male", "female"]);
export const maritalStatusEnum = pgEnum("marital_status", [
  "single",
  "married",
  "widowed",
  "divorced",
]);
export const memberTypeEnum = pgEnum("member_type", ["regular", "guest"]);
export const scheduleTypeEnum = pgEnum("schedule_type", [
  "weekly",
  "biweekly",
  "monthly",
]);
export const attendanceStatusEnum = pgEnum("attendance_status", [
  "present",
  "absent",
  "excused",
]);
export const sourceEnum = pgEnum("source", ["web", "telegram"]);

// Tables
export const churches = pgTable("churches", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  plan: text("plan").notNull().default("free"),
  billingEmail: text("billing_email"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  churchId: uuid("church_id")
    .notNull()
    .references(() => churches.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  hashedPassword: text("hashed_password").notNull(),
  role: roleEnum("role").notNull().default("cell_leader"),
  deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
});

export const tags = pgTable("tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  churchId: uuid("church_id")
    .notNull()
    .references(() => churches.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  colour: text("colour").notNull().default("#6366f1"),
  description: text("description"),
});

export const userTagAccess = pgTable(
  "user_tag_access",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    grantedBy: uuid("granted_by")
      .notNull()
      .references(() => users.id),
    grantedAt: timestamp("granted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.tagId] }),
  })
);

export const members = pgTable("members", {
  id: uuid("id").primaryKey().defaultRandom(),
  churchId: uuid("church_id")
    .notNull()
    .references(() => churches.id, { onDelete: "cascade" }),
  fullName: text("full_name").notNull(),
  phone: text("phone"),
  email: text("email"),
  dob: date("dob"),
  address: text("address"),
  gender: genderEnum("gender"),
  maritalStatus: maritalStatusEnum("marital_status"),
  baptisedAt: date("baptised_at"),
  joinedAt: date("joined_at").notNull(),
  type: memberTypeEnum("type").notNull().default("regular"),
  photoR2Key: text("photo_r2_key"),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
});

export const memberTags = pgTable(
  "member_tags",
  {
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    assignedBy: uuid("assigned_by")
      .notNull()
      .references(() => users.id),
    assignedAt: timestamp("assigned_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.memberId, t.tagId] }),
  })
);

export const groups = pgTable("groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  churchId: uuid("church_id")
    .notNull()
    .references(() => churches.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  scheduleType: scheduleTypeEnum("schedule_type").notNull().default("weekly"),
  meetingDay: text("meeting_day"),
  meetingTime: time("meeting_time"),
  location: text("location"),
  zoneId: uuid("zone_id"),
  leaderUserId: uuid("leader_user_id")
    .notNull()
    .references(() => users.id),
  absenceThreshold: integer("absence_threshold").notNull().default(2),
});

export const groupMemberships = pgTable("group_memberships", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => groups.id, { onDelete: "cascade" }),
  memberId: uuid("member_id")
    .notNull()
    .references(() => members.id, { onDelete: "cascade" }),
  joinedAt: date("joined_at").notNull(),
  leftAt: date("left_at"),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => groups.id, { onDelete: "cascade" }),
  sessionDate: date("session_date").notNull(),
  topic: text("topic"),
  notes: text("notes"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const attendanceRecords = pgTable("attendance_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  memberId: uuid("member_id")
    .notNull()
    .references(() => members.id, { onDelete: "cascade" }),
  status: attendanceStatusEnum("status").notNull(),
  reason: text("reason"),
  recordedBy: uuid("recorded_by")
    .notNull()
    .references(() => users.id),
  source: sourceEnum("source").notNull().default("web"),
});

export const pastoralNotes = pgTable("pastoral_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  memberId: uuid("member_id")
    .notNull()
    .references(() => members.id, { onDelete: "cascade" }),
  authorUserId: uuid("author_user_id")
    .notNull()
    .references(() => users.id),
  bodyHtml: text("body_html").notNull(),
  source: sourceEnum("source").notNull().default("web"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  attachments: text("attachments").array().notNull().default([]),
});

export const followUpFlags = pgTable("follow_up_flags", {
  id: uuid("id").primaryKey().defaultRandom(),
  memberId: uuid("member_id")
    .notNull()
    .references(() => members.id, { onDelete: "cascade" }),
  groupId: uuid("group_id")
    .notNull()
    .references(() => groups.id, { onDelete: "cascade" }),
  consecutiveAbsences: integer("consecutive_absences").notNull(),
  flaggedAt: timestamp("flagged_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  resolvedBy: uuid("resolved_by").references(() => users.id),
  resolutionNote: text("resolution_note"),
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  churchId: uuid("church_id")
    .notNull()
    .references(() => churches.id, { onDelete: "cascade" }),
  actorUserId: uuid("actor_user_id")
    .notNull()
    .references(() => users.id),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  diffJson: text("diff_json"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const telegramLinks = pgTable("telegram_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  telegramId: text("telegram_id").notNull().unique(),
  linkedAt: timestamp("linked_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export const telegramLinkCodes = pgTable("telegram_link_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  code: text("code").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
});
