CREATE TYPE "public"."attendance_status" AS ENUM('present', 'excused');--> statement-breakpoint
ALTER TABLE "session_attendance" ADD COLUMN "status" "attendance_status" DEFAULT 'present' NOT NULL;--> statement-breakpoint
ALTER TABLE "session_attendance" ADD COLUMN "reason" text DEFAULT '' NOT NULL;