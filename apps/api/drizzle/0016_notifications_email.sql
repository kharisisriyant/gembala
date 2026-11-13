CREATE TYPE "public"."notification_consent_source" AS ENUM('settings', 'email_link', 'bot_command');--> statement-breakpoint
CREATE TYPE "public"."notification_endpoint_status" AS ENUM('active', 'bounced');--> statement-breakpoint
CREATE TABLE "channel_endpoints" (
	"user_id" uuid NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"address" text NOT NULL,
	"status" "notification_endpoint_status" DEFAULT 'active' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consent_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"category" "notification_category" NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"enabled" boolean NOT NULL,
	"source" "notification_consent_source" NOT NULL,
	"actor_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "channel_endpoints" ADD CONSTRAINT "channel_endpoints_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_events" ADD CONSTRAINT "consent_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_events" ADD CONSTRAINT "consent_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "channel_endpoints_user_channel_uq" ON "channel_endpoints" USING btree ("user_id","channel");--> statement-breakpoint
CREATE INDEX "consent_events_user_idx" ON "consent_events" USING btree ("user_id","created_at");