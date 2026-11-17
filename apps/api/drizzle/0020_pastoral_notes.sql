CREATE TYPE "public"."pastoral_note_source" AS ENUM('web', 'telegram');--> statement-breakpoint
CREATE TABLE "pastoral_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"author_user_id" uuid,
	"body" text NOT NULL,
	"source" "pastoral_note_source" DEFAULT 'web' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pastoral_notes" ADD CONSTRAINT "pastoral_notes_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pastoral_notes" ADD CONSTRAINT "pastoral_notes_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pastoral_notes" ADD CONSTRAINT "pastoral_notes_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pastoral_notes_org_member_idx" ON "pastoral_notes" USING btree ("org_id","member_id");