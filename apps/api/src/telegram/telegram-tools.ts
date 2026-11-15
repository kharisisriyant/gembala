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
      name: "add_member",
      description:
        "Add a new member to the org. Confirm name, email/phone, and tags with the user before calling.",
      parameters: {
        type: "object",
        required: ["name", "tags"],
        properties: {
          name: { type: "string", description: "Full name" },
          email: { type: "string", description: "Email address (optional)" },
          phone: { type: "string", description: "Phone number (optional)" },
          tags: {
            type: "array",
            items: { type: "string" },
            description: "At least one tag name (controls who can see this member)",
          },
          status: {
            type: "string",
            enum: ["active", "newcomer", "inactive", "moved"],
            description: "Defaults to active",
          },
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
      description:
        "List past attendance sessions for a group, most recent first. Each session has presentIds and excused " +
        "(memberId + reason); roster members in neither list were absent.",
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
      name: "create_group",
      description:
        "Create a new small group. Look up the leader and member ids first via list_members. Confirm the name, leader, and roster with the user before calling.",
      parameters: {
        type: "object",
        required: ["name", "leader_id", "scope_tag"],
        properties: {
          name: { type: "string", description: "Group name" },
          leader_id: { type: "string", description: "Leader's member UUID" },
          scope_tag: { type: "string", description: "Tag name controlling who can see this group" },
          member_ids: {
            type: "array",
            items: { type: "string" },
            description: "Member UUIDs in the group (leader is added automatically)",
          },
          schedule: { type: "string", description: "e.g. Fri 7:00 PM (optional)" },
          location: { type: "string", description: "Meeting location (optional)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_group",
      description:
        "Update an existing small group. Only include fields that are changing. Confirm the changes with the user before calling.",
      parameters: {
        type: "object",
        required: ["group_id"],
        properties: {
          group_id: { type: "string", description: "Group UUID" },
          name: { type: "string", description: "New group name" },
          leader_id: { type: "string", description: "New leader's member UUID" },
          scope_tag: { type: "string", description: "New scope tag name" },
          member_ids: {
            type: "array",
            items: { type: "string" },
            description: "Full replacement roster of member UUIDs (leader is added automatically)",
          },
          schedule: { type: "string", description: "e.g. Fri 7:00 PM" },
          location: { type: "string", description: "Meeting location" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "log_session",
      description:
        "Log a small group session. Each roster member is present, excused, or absent (listed in neither). " +
        "A member who could not come for a reason the leader gives (\"izin\", \"sakit\", \"excused — sick\", " +
        "\"out of town\") goes in `excused` with that reason, not in present_member_ids; anyone not mentioned is absent. " +
        "Excused sessions do not count toward the absence follow-up list. " +
        "Confirm the present and excused lists with the user before calling.",
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
          excused: {
            type: "array",
            description:
              "Members who were excused (optional). Must be on the roster and not also in present_member_ids.",
            items: {
              type: "object",
              required: ["member_id"],
              properties: {
                member_id: { type: "string", description: "Member UUID" },
                reason: { type: "string", description: "Short reason, e.g. sick, travelling (optional, max 200 chars)" },
              },
            },
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_absence_report",
      description:
        "Members currently flagged for follow-up because they missed 2 or more consecutive sessions of their small group " +
        "(excused sessions are skipped). Same list as the dashboard's attendance alerts, scoped to the caller. " +
        "Use this for questions like \"who hasn't come in a while\" or \"siapa yang sudah lama tidak datang\".",
      parameters: {
        type: "object",
        properties: {
          group_id: { type: "string", description: "Only this group (UUID, from list_groups). Optional." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_birthdays",
      description:
        "Members in the caller's scope whose birthday falls within the next `days` days, counting today as the first day " +
        "(days=1 is today only, days=7 is this coming week).",
      parameters: {
        type: "object",
        properties: {
          days: { type: "integer", description: "Window length in days, 1-60. Defaults to 7." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_care_requests",
      description:
        "List prayer and care requests about members the caller can see, newest first. Defaults to open requests. " +
        "To filter by member, resolve the member's UUID first with list_members or get_member.",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["open", "closed", "all"],
            description: "Defaults to open",
          },
          type: { type: "string", enum: ["prayer", "care"], description: "Only this request type (optional)" },
          member_id: { type: "string", description: "Only requests about this member (UUID, optional)" },
          assigned_to_me: { type: "boolean", description: "Only requests the caller owns (optional)" },
          overdue_only: { type: "boolean", description: "Only open requests past their due date (optional)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_care_request",
      description:
        "Record a prayer or care request about a member. The member must be resolved to a UUID first via list_members " +
        "or get_member; if the name is ambiguous, ask which one. Confirm the member, the type, and the request text with " +
        "the user before calling. The caller becomes the owner; the due date defaults to 7 days from today.",
      parameters: {
        type: "object",
        required: ["member_id", "type", "body"],
        properties: {
          member_id: { type: "string", description: "Member UUID" },
          type: { type: "string", enum: ["prayer", "care"], description: "prayer = prayer request, care = pastoral care need" },
          body: { type: "string", description: "What the request is about, max 2000 chars" },
          due_at: { type: "string", description: "Follow-up due date, YYYY-MM-DD (optional, defaults to today + 7 days)" },
        },
      },
    },
  },
]
