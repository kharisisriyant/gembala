CREATE TABLE "telegram_link_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"code" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "telegram_link_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "telegram_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"telegram_chat_id" text NOT NULL,
	"telegram_username" text,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "telegram_link_codes" ADD CONSTRAINT "telegram_link_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_links" ADD CONSTRAINT "telegram_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "telegram_link_codes_user_idx" ON "telegram_link_codes" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "telegram_links_user_active_uq" ON "telegram_links" USING btree ("user_id") WHERE revoked_at is null;--> statement-breakpoint
CREATE UNIQUE INDEX "telegram_links_chat_active_uq" ON "telegram_links" USING btree ("telegram_chat_id") WHERE revoked_at is null;