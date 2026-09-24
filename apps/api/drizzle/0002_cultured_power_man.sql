CREATE TYPE "public"."member_baptism_status" AS ENUM('not_baptized', 'baptized');--> statement-breakpoint
CREATE TYPE "public"."member_gender" AS ENUM('male', 'female');--> statement-breakpoint
CREATE TYPE "public"."member_marital_status" AS ENUM('single', 'married', 'widowed', 'divorced');--> statement-breakpoint
ALTER TYPE "public"."member_status" ADD VALUE 'moved';--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "date_of_birth" date;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "gender" "member_gender";--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "marital_status" "member_marital_status";--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "address" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "occupation" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "notes" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "photo_url" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "baptism_status" "member_baptism_status";--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "baptism_date" date;