CREATE TYPE "public"."care_request_source" AS ENUM('leader', 'member');--> statement-breakpoint
CREATE TYPE "public"."care_request_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TYPE "public"."care_request_type" AS ENUM('prayer', 'care');--> statement-breakpoint
CREATE TABLE "care_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"type" "care_request_type" NOT NULL,
	"body" text NOT NULL,
	"status" "care_request_status" DEFAULT 'open' NOT NULL,
	"source" "care_request_source" NOT NULL,
	"submitted_by_user_id" uuid,
	"closed_at" timestamp with time zone,
	"closed_by_user_id" uuid,
	"close_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "care_requests" ADD CONSTRAINT "care_requests_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_requests" ADD CONSTRAINT "care_requests_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_requests" ADD CONSTRAINT "care_requests_submitted_by_user_id_users_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_requests" ADD CONSTRAINT "care_requests_closed_by_user_id_users_id_fk" FOREIGN KEY ("closed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "care_requests_org_status_idx" ON "care_requests" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "care_requests_member_idx" ON "care_requests" USING btree ("member_id");--> statement-breakpoint
-- Grant care-request access to every existing org's "Leader" role — keep in
-- step with LEADER_BASELINE_PERMISSIONS in apps/api/src/auth/auth.service.ts.
INSERT INTO "role_permissions" ("role_id", "permission")
SELECT r."id", p.permission
FROM "roles" r
CROSS JOIN (VALUES
  ('care_requests:read'), ('care_requests:create'), ('care_requests:update')
) AS p(permission)
WHERE r."name" = 'Leader'
ON CONFLICT DO NOTHING;
