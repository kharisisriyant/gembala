CREATE TABLE "user_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"locale" text DEFAULT 'id' NOT NULL,
	"timezone" text DEFAULT 'Asia/Jakarta' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Carry existing digest languages over so nobody's notification language resets.
INSERT INTO "user_settings" ("user_id", "locale") SELECT "user_id", "locale" FROM "digest_preferences" ON CONFLICT DO NOTHING;
