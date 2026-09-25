CREATE TABLE "invite_roles" (
	"invite_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	CONSTRAINT "invite_roles_invite_id_role_id_pk" PRIMARY KEY("invite_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "membership_roles" (
	"membership_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	CONSTRAINT "membership_roles_membership_id_role_id_pk" PRIMARY KEY("membership_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" uuid NOT NULL,
	"permission" text NOT NULL,
	CONSTRAINT "role_permissions_role_id_permission_pk" PRIMARY KEY("role_id","permission")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"is_system_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invite_roles" ADD CONSTRAINT "invite_roles_invite_id_invites_id_fk" FOREIGN KEY ("invite_id") REFERENCES "public"."invites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_roles" ADD CONSTRAINT "invite_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_roles" ADD CONSTRAINT "membership_roles_membership_id_org_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."org_memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_roles" ADD CONSTRAINT "membership_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "roles_org_name_uq" ON "roles" USING btree ("org_id","name");--> statement-breakpoint
CREATE INDEX "roles_org_idx" ON "roles" USING btree ("org_id");--> statement-breakpoint
-- Seed one protected "Admin" role and one starter "Leader" role per existing org.
INSERT INTO "roles" ("id", "org_id", "name", "description", "is_system_admin")
SELECT gen_random_uuid(), "id", 'Admin', 'Full access to everything.', true FROM "organizations";
--> statement-breakpoint
INSERT INTO "roles" ("id", "org_id", "name", "description", "is_system_admin")
SELECT gen_random_uuid(), "id", 'Leader', 'Read/write members and groups; read-only elsewhere.', false FROM "organizations";
--> statement-breakpoint
-- Baseline permission set for every org's new "Leader" role — keep this list
-- byte-identical to LEADER_BASELINE_PERMISSIONS in apps/api/src/auth/auth.service.ts.
INSERT INTO "role_permissions" ("role_id", "permission")
SELECT r."id", p.permission
FROM "roles" r
CROSS JOIN (VALUES
  ('members:read'), ('members:create'), ('members:update'),
  ('groups:read'), ('groups:create'), ('groups:update'),
  ('households:read'), ('tags:read'), ('rooms:read'), ('events:read')
) AS p(permission)
WHERE r."name" = 'Leader';
--> statement-breakpoint
-- Attach every existing admin membership to its org's new Admin role.
INSERT INTO "membership_roles" ("membership_id", "role_id")
SELECT om."id", r."id"
FROM "org_memberships" om
JOIN "roles" r ON r."org_id" = om."org_id" AND r."name" = 'Admin'
WHERE om."role" = 'admin';
--> statement-breakpoint
-- Attach every existing leader membership to its org's new Leader role.
INSERT INTO "membership_roles" ("membership_id", "role_id")
SELECT om."id", r."id"
FROM "org_memberships" om
JOIN "roles" r ON r."org_id" = om."org_id" AND r."name" = 'Leader'
WHERE om."role" = 'leader';
--> statement-breakpoint
ALTER TABLE "invites" DROP COLUMN "role_label";--> statement-breakpoint
ALTER TABLE "org_memberships" DROP COLUMN "role";--> statement-breakpoint
ALTER TABLE "org_memberships" DROP COLUMN "role_label";--> statement-breakpoint
DROP TYPE "public"."membership_role";