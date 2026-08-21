export type TelegramToolDef = {
  type: "function"
  function: {
    name: string
    description: string
    parameters: {
      type: "object"
      properties: Record<string, unknown>
      required?: string[]
    }
  }
}

export const TELEGRAM_TOOLS: TelegramToolDef[] = [
  {
    type: "function",
    function: {
      name: "list_members",
      description:
        "Search members by free-text (name, email, phone) and/or tag. Scoped to the caller's church and tag access.",
      parameters: {
        type: "object",
        properties: {
          q: { type: "string", description: "Full-text search: name, email, or phone" },
          tag: { type: "string", description: "Filter by tag name" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_member",
      description: "Retrieve a single member's profile and group memberships by name or UUID.",
      parameters: {
        type: "object",
        required: ["name_or_id"],
        properties: {
          name_or_id: { type: "string", description: "Member full name or UUID" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_groups",
      description: "List all small groups visible to the caller, with id, name, leader, and roster.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "list_sessions",
      description: "List past attendance sessions for a group, most recent first.",
      parameters: {
        type: "object",
        required: ["group_id"],
        properties: {
          group_id: { type: "string", description: "Group UUID" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "log_session",
      description:
        "Log a small group session with who was present. Confirm the member list with the user before calling.",
      parameters: {
        type: "object",
        required: ["group_id", "date", "present_member_ids"],
        properties: {
          group_id: { type: "string", description: "Group UUID" },
          date: { type: "string", description: "ISO date, e.g. 2026-05-21" },
          topic: { type: "string", description: "Session topic (optional)" },
          present_member_ids: {
            type: "array",
            items: { type: "string" },
            description: "UUIDs of members who attended — must already be in the group's roster",
          },
        },
      },
    },
  },
]
