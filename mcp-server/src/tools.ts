import type { Tool } from "@anthropic-ai/sdk/resources/messages";

export const TOOLS: Tool[] = [
  {
    name: "list_members",
    description: "Query members by name, tag, group, or absence status. Scoped to caller's church and tag access.",
    input_schema: {
      type: "object" as const,
      properties: {
        q: { type: "string", description: "Full-text search query (name, phone, email)" },
        tag: { type: "string", description: "Filter by tag ID" },
        type: { type: "string", enum: ["regular", "guest"], description: "Filter by member type" },
      },
    },
  },
  {
    name: "get_member",
    description: "Retrieve a single member's profile and attendance history by name or ID.",
    input_schema: {
      type: "object" as const,
      required: ["name_or_id"],
      properties: {
        name_or_id: { type: "string", description: "Member full name or UUID" },
      },
    },
  },
  {
    name: "list_sessions",
    description: "List recent sessions for a group.",
    input_schema: {
      type: "object" as const,
      required: ["group_id"],
      properties: {
        group_id: { type: "string", description: "Group UUID" },
      },
    },
  },
  {
    name: "create_session",
    description: "Create a new session for a group.",
    input_schema: {
      type: "object" as const,
      required: ["group_id", "session_date"],
      properties: {
        group_id: { type: "string" },
        session_date: { type: "string", description: "ISO date e.g. 2026-05-21" },
        topic: { type: "string" },
      },
    },
  },
  {
    name: "record_attendance",
    description: "Write attendance records for a session. Confirm with user before calling.",
    input_schema: {
      type: "object" as const,
      required: ["session_id", "group_id", "records"],
      properties: {
        session_id: { type: "string" },
        group_id: { type: "string" },
        records: {
          type: "array",
          items: {
            type: "object",
            required: ["member_id", "status"],
            properties: {
              member_id: { type: "string" },
              status: { type: "string", enum: ["present", "absent", "excused"] },
              reason: { type: "string" },
            },
          },
        },
      },
    },
  },
  {
    name: "add_pastoral_note",
    description: "Create a pastoral note for a member. Confirm member match before calling.",
    input_schema: {
      type: "object" as const,
      required: ["member_id", "body"],
      properties: {
        member_id: { type: "string" },
        body: { type: "string", description: "Note content" },
      },
    },
  },
  {
    name: "get_absence_report",
    description: "Return members currently flagged for follow-up (consecutive absences).",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "get_birthdays",
    description: "Return members with birthdays in the next N days.",
    input_schema: {
      type: "object" as const,
      properties: {
        days: { type: "number", description: "Number of days ahead to look (default 7)" },
      },
    },
  },
];
