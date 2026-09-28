CREATE TYPE "public"."course_kind" AS ENUM('catechism', 'baptism_prep', 'sidi_prep', 'discipleship', 'other');--> statement-breakpoint
CREATE TYPE "public"."enrollment_status" AS ENUM('enrolled', 'completed', 'dropped');--> statement-breakpoint
CREATE TYPE "public"."leadership_level" AS ENUM('emerging', 'ready');--> statement-breakpoint
CREATE TYPE "public"."leadership_target_role" AS ENUM('cell_leader', 'ministry_coordinator');--> statement-breakpoint
CREATE TYPE "public"."milestone_type" AS ENUM('first_visit', 'follow_up_contact', 'joined_class', 'joined_group', 'baptism', 'sidi', 'catechism_completed');--> statement-breakpoint
CREATE TABLE "course_enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"status" "enrollment_status" DEFAULT 'enrolled' NOT NULL,
	"started_at" date NOT NULL,
	"completed_at" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" "course_kind" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leadership_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"level" "leadership_level" NOT NULL,
	"target_role" "leadership_target_role" NOT NULL,
	"note" text,
	"assessed_by_user_id" uuid,
	"assessed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"type" "milestone_type" NOT NULL,
	"achieved_at" date NOT NULL,
	"note" text,
	"recorded_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "course_enrollments" ADD CONSTRAINT "course_enrollments_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_enrollments" ADD CONSTRAINT "course_enrollments_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_enrollments" ADD CONSTRAINT "course_enrollments_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leadership_assessments" ADD CONSTRAINT "leadership_assessments_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leadership_assessments" ADD CONSTRAINT "leadership_assessments_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leadership_assessments" ADD CONSTRAINT "leadership_assessments_assessed_by_user_id_users_id_fk" FOREIGN KEY ("assessed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_milestones" ADD CONSTRAINT "member_milestones_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_milestones" ADD CONSTRAINT "member_milestones_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_milestones" ADD CONSTRAINT "member_milestones_recorded_by_user_id_users_id_fk" FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "course_enrollments_member_course_uq" ON "course_enrollments" USING btree ("member_id","course_id");--> statement-breakpoint
CREATE INDEX "course_enrollments_org_idx" ON "course_enrollments" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "course_enrollments_course_idx" ON "course_enrollments" USING btree ("course_id");--> statement-breakpoint
CREATE UNIQUE INDEX "courses_org_name_uq" ON "courses" USING btree ("org_id","name");--> statement-breakpoint
CREATE INDEX "leadership_assessments_member_idx" ON "leadership_assessments" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "leadership_assessments_org_idx" ON "leadership_assessments" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "member_milestones_member_idx" ON "member_milestones" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "member_milestones_org_idx" ON "member_milestones" USING btree ("org_id");--> statement-breakpoint
-- Grant journey/course access to every existing org's "Leader" role — keep in
-- step with LEADER_BASELINE_PERMISSIONS in apps/api/src/auth/auth.service.ts.
INSERT INTO "role_permissions" ("role_id", "permission")
SELECT r."id", p.permission
FROM "roles" r
CROSS JOIN (VALUES
  ('journey:read'), ('journey:create'), ('journey:update'), ('courses:read')
) AS p(permission)
WHERE r."name" = 'Leader'
ON CONFLICT DO NOTHING;
