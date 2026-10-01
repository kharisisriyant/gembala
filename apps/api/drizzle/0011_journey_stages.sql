CREATE TYPE "public"."journey_stage_rule" AS ENUM('manual', 'newcomer_followup', 'course_completed', 'leadership_ready');--> statement-breakpoint
CREATE TABLE "journey_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"rule" "journey_stage_rule" DEFAULT 'manual' NOT NULL,
	"reminder_days" integer DEFAULT 0 NOT NULL,
	"course_kind" "course_kind",
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journey_stage_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"stage_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"assigned_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "journey_stages" ADD CONSTRAINT "journey_stages_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journey_stage_assignments" ADD CONSTRAINT "journey_stage_assignments_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journey_stage_assignments" ADD CONSTRAINT "journey_stage_assignments_stage_id_journey_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."journey_stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journey_stage_assignments" ADD CONSTRAINT "journey_stage_assignments_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journey_stage_assignments" ADD CONSTRAINT "journey_stage_assignments_assigned_by_user_id_users_id_fk" FOREIGN KEY ("assigned_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "journey_stages_org_name_uq" ON "journey_stages" USING btree ("org_id","name");--> statement-breakpoint
CREATE INDEX "journey_stages_org_idx" ON "journey_stages" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "journey_stage_assignments_stage_member_uq" ON "journey_stage_assignments" USING btree ("stage_id","member_id");--> statement-breakpoint
CREATE INDEX "journey_stage_assignments_member_idx" ON "journey_stage_assignments" USING btree ("member_id");
--> statement-breakpoint
INSERT INTO "journey_stages" ("org_id", "name", "rule", "reminder_days", "course_kind", "sort_order")
SELECT "id", stage_name, stage_rule::"journey_stage_rule", reminder_days, course_kind::"course_kind", sort_order
FROM "organizations"
CROSS JOIN (VALUES
  ('Newcomer follow-up', 'newcomer_followup', 30, NULL, 0)
) AS defaults(stage_name, stage_rule, reminder_days, course_kind, sort_order);
