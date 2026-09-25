CREATE TABLE "instance_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_instance_id" uuid NOT NULL,
	"role_template_id" uuid NOT NULL,
	"member_id" uuid,
	"free_text" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedule_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"date" date NOT NULL,
	"scripture_ref" text DEFAULT '' NOT NULL,
	"theme" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_instances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"instance_type_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "instance_types" ADD CONSTRAINT "instance_types_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_service_instance_id_service_instances_id_fk" FOREIGN KEY ("service_instance_id") REFERENCES "public"."service_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_role_template_id_role_templates_id_fk" FOREIGN KEY ("role_template_id") REFERENCES "public"."role_templates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_templates" ADD CONSTRAINT "role_templates_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_events" ADD CONSTRAINT "schedule_events_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_instances" ADD CONSTRAINT "service_instances_event_id_schedule_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."schedule_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_instances" ADD CONSTRAINT "service_instances_instance_type_id_instance_types_id_fk" FOREIGN KEY ("instance_type_id") REFERENCES "public"."instance_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "instance_types_org_name_uq" ON "instance_types" USING btree ("org_id","name");--> statement-breakpoint
CREATE INDEX "instance_types_org_idx" ON "instance_types" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "role_assignments_instance_idx" ON "role_assignments" USING btree ("service_instance_id");--> statement-breakpoint
CREATE INDEX "role_assignments_role_idx" ON "role_assignments" USING btree ("role_template_id");--> statement-breakpoint
CREATE INDEX "role_assignments_member_idx" ON "role_assignments" USING btree ("member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "role_templates_org_name_uq" ON "role_templates" USING btree ("org_id","name");--> statement-breakpoint
CREATE INDEX "role_templates_org_idx" ON "role_templates" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "schedule_events_org_idx" ON "schedule_events" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "schedule_events_date_idx" ON "schedule_events" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "service_instances_event_type_uq" ON "service_instances" USING btree ("event_id","instance_type_id");--> statement-breakpoint
CREATE INDEX "service_instances_event_idx" ON "service_instances" USING btree ("event_id");