CREATE TABLE "google_calendar_connections" (
	"org_id" uuid PRIMARY KEY NOT NULL,
	"connected_by" uuid,
	"google_email" text NOT NULL,
	"refresh_token_enc" text NOT NULL,
	"events_calendar_id" text,
	"rooms_calendar_id" text,
	"last_error" text,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "google_sub" text;--> statement-breakpoint
ALTER TABLE "google_calendar_connections" ADD CONSTRAINT "google_calendar_connections_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_calendar_connections" ADD CONSTRAINT "google_calendar_connections_connected_by_users_id_fk" FOREIGN KEY ("connected_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_google_sub_unique" UNIQUE("google_sub");