// Barrel re-export of every module's schema file. This is what
// drizzle.config.ts points at, and how code that wants "any table"
// (seed scripts, cross-module joins via "../db/schema") keeps working.
// See apps/api/architecture.md for the module schema layout.
export * from "../auth/auth.schema"
export * from "../tags/tags.schema"
export * from "../roles/roles.schema"
export * from "../members/members.schema"
export * from "../households/households.schema"
export * from "../groups/groups.schema"
export * from "../rooms/rooms.schema"
export * from "../events/events.schema"
export * from "../scheduling/scheduling.schema"
export * from "../invites/invites.schema"
export * from "../telegram/telegram.schema"
export * from "../care-requests/care-requests.schema"
export * from "../journey/journey.schema"
