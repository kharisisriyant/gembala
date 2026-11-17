CREATE TYPE "public"."notification_skip_reason" AS ENUM('preference', 'not_connected', 'expired', 'suppressed', 'no_access', 'kill_switch');--> statement-breakpoint
CREATE TYPE "public"."notification_delivery_status" AS ENUM('pending', 'queued', 'sent', 'delivered', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."notification_category" AS ENUM('security', 'transactional', 'activity', 'reminder', 'product_updates');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('inapp', 'email', 'telegram');--> statement-breakpoint
CREATE TYPE "public"."notification_priority" AS ENUM('high', 'normal', 'low');--> statement-breakpoint
CREATE TABLE "notification_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notification_id" uuid NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"status" "notification_delivery_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"provider_message_id" text,
	"error_code" text,
	"skip_reason" "notification_skip_reason",
	"send_at" timestamp with time zone,
	"next_attempt_at" timestamp with time zone,
	"correlation_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"type_key" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"recipient_user_ids" jsonb NOT NULL,
	"payload" jsonb NOT NULL,
	"actor_user_id" uuid,
	"send_at" timestamp with time zone,
	"correlation_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_kill_switches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type_key" text,
	"channel" "notification_channel",
	"reason" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"type_key" text NOT NULL,
	"category" "notification_category" NOT NULL,
	"priority" "notification_priority" NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"link" text,
	"collapse_key" text,
	"read_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"correlation_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_notification_preferences" (
	"user_id" uuid NOT NULL,
	"category" "notification_category" NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"enabled" boolean NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_event_id_notification_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."notification_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notification_preferences" ADD CONSTRAINT "user_notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_deliveries_notification_channel_uq" ON "notification_deliveries" USING btree ("notification_id","channel");--> statement-breakpoint
CREATE INDEX "notification_deliveries_open_idx" ON "notification_deliveries" USING btree ("status","updated_at") WHERE "notification_deliveries"."status" in ('pending','queued');--> statement-breakpoint
CREATE UNIQUE INDEX "notification_events_idempotency_uq" ON "notification_events" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "notification_events_unprocessed_idx" ON "notification_events" USING btree ("created_at") WHERE "notification_events"."processed_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_event_user_uq" ON "notifications" USING btree ("event_id","user_id");--> statement-breakpoint
CREATE INDEX "notifications_user_org_created_idx" ON "notifications" USING btree ("user_id","org_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_unread_idx" ON "notifications" USING btree ("user_id","org_id") WHERE "notifications"."read_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "user_notification_preferences_uq" ON "user_notification_preferences" USING btree ("user_id","category","channel");