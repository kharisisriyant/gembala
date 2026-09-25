CREATE TYPE "public"."member_relationship_type" AS ENUM('spouse', 'parent_of', 'sibling_of', 'guardian_of', 'grandparent_of', 'other');--> statement-breakpoint
CREATE TABLE "households" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"primary_contact_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_relationships" (
	"member_id" uuid NOT NULL,
	"related_member_id" uuid NOT NULL,
	"relation_type" "member_relationship_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "member_relationships_member_id_related_member_id_relation_type_pk" PRIMARY KEY("member_id","related_member_id","relation_type")
);
--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "household_id" uuid;--> statement-breakpoint
ALTER TABLE "households" ADD CONSTRAINT "households_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "households" ADD CONSTRAINT "households_primary_contact_member_id_members_id_fk" FOREIGN KEY ("primary_contact_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_relationships" ADD CONSTRAINT "member_relationships_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_relationships" ADD CONSTRAINT "member_relationships_related_member_id_members_id_fk" FOREIGN KEY ("related_member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "households_org_idx" ON "households" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "member_relationships_related_idx" ON "member_relationships" USING btree ("related_member_id");--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "members_household_idx" ON "members" USING btree ("household_id");