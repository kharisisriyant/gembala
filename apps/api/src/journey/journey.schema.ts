import { boolean, date, index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core"
import { organizations, users } from "../auth/auth.schema"
import { members } from "../members/members.schema"

export const milestoneType = pgEnum("milestone_type", [
  "first_visit",
  "follow_up_contact",
  "joined_class",
  "joined_group",
  "baptism",
  "sidi",
  "catechism_completed",
])
export const courseKind = pgEnum("course_kind", [
  "catechism",
  "baptism_prep",
  "sidi_prep",
  "discipleship",
  "other",
])
export const enrollmentStatus = pgEnum("enrollment_status", ["enrolled", "completed", "dropped"])
export const leadershipLevel = pgEnum("leadership_level", ["emerging", "ready"])
export const leadershipTargetRole = pgEnum("leadership_target_role", [
  "cell_leader",
  "ministry_coordinator",
])
export const journeyStageRule = pgEnum("journey_stage_rule", ["manual", "newcomer_followup", "course_completed", "leadership_ready"])

export const journeyStages = pgTable(
  "journey_stages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    rule: journeyStageRule("rule").notNull().default("manual"),
    reminderDays: integer("reminder_days").notNull().default(0),
    courseKind: courseKind("course_kind"),
    sortOrder: integer("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("journey_stages_org_name_uq").on(t.orgId, t.name), index("journey_stages_org_idx").on(t.orgId)],
)

export const journeyStageAssignments = pgTable(
  "journey_stage_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    stageId: uuid("stage_id").notNull().references(() => journeyStages.id, { onDelete: "cascade" }),
    memberId: uuid("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
    assignedByUserId: uuid("assigned_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("journey_stage_assignments_stage_member_uq").on(t.stageId, t.memberId), index("journey_stage_assignments_member_idx").on(t.memberId)],
)

export const memberMilestones = pgTable(
  "member_milestones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    type: milestoneType("type").notNull(),
    achievedAt: date("achieved_at").notNull(),
    note: text("note"),
    recordedByUserId: uuid("recorded_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("member_milestones_member_idx").on(t.memberId), index("member_milestones_org_idx").on(t.orgId)],
)

export const courses = pgTable(
  "courses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: courseKind("kind").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("courses_org_name_uq").on(t.orgId, t.name)],
)

export const courseEnrollments = pgTable(
  "course_enrollments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "restrict" }),
    status: enrollmentStatus("status").notNull().default("enrolled"),
    startedAt: date("started_at").notNull(),
    completedAt: date("completed_at"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("course_enrollments_member_course_uq").on(t.memberId, t.courseId),
    index("course_enrollments_org_idx").on(t.orgId),
    index("course_enrollments_course_idx").on(t.courseId),
  ],
)

export const leadershipAssessments = pgTable(
  "leadership_assessments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    level: leadershipLevel("level").notNull(),
    targetRole: leadershipTargetRole("target_role").notNull(),
    note: text("note"),
    assessedByUserId: uuid("assessed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    assessedAt: timestamp("assessed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("leadership_assessments_member_idx").on(t.memberId),
    index("leadership_assessments_org_idx").on(t.orgId),
  ],
)
