ALTER TABLE "care_requests" ADD COLUMN "assigned_to_user_id" uuid;--> statement-breakpoint
ALTER TABLE "care_requests" ADD COLUMN "due_at" date;--> statement-breakpoint
ALTER TABLE "care_requests" ADD CONSTRAINT "care_requests_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "care_requests_assignee_status_idx" ON "care_requests" USING btree ("assigned_to_user_id","status");--> statement-breakpoint
-- Backfill: existing requests belong to whoever filed them. Open ones are due a
-- week from deploy (not from created_at) so the first digest is not flooded.
UPDATE "care_requests" SET "assigned_to_user_id" = "submitted_by_user_id";--> statement-breakpoint
UPDATE "care_requests" SET "due_at" = (now() AT TIME ZONE 'Asia/Jakarta')::date + 7 WHERE "status" = 'open';
