CREATE TYPE "public"."roster_response_status" AS ENUM('pending', 'confirmed', 'declined');--> statement-breakpoint
ALTER TABLE "role_assignments" ADD COLUMN "link_nonce" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD COLUMN "response_status" "roster_response_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD COLUMN "responded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD COLUMN "decline_reason" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD COLUMN "notified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD COLUMN "requested_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;