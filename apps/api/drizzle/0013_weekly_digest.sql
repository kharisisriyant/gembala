CREATE TYPE "public"."digest_channel" AS ENUM('telegram', 'email');--> statement-breakpoint
CREATE TYPE "public"."digest_status" AS ENUM('pending', 'sent', 'failed');--> statement-breakpoint
CREATE TABLE "digest_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"week_start" date NOT NULL,
	"status" "digest_status" DEFAULT 'pending' NOT NULL,
	"channel" "digest_channel",
	"error" text,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "digest_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"locale" text DEFAULT 'id' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "digest_log" ADD CONSTRAINT "digest_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digest_preferences" ADD CONSTRAINT "digest_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "digest_log_user_week_uq" ON "digest_log" USING btree ("user_id","week_start");