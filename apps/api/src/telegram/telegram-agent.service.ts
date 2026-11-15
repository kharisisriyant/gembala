import { ForbiddenException, Injectable, Logger } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { ModuleRef } from "@nestjs/core"
import { z } from "zod"
import {
  careRequestCreateSchema,
  careRequestStatusSchema,
  careRequestTypeSchema,
  permissionKey,
  sessionCreateSchema,
  todayInZone,
  type CareRequestResponse,
  type PermissionAction,
  type PermissionResource,
  type SessionResponse,
} from "@gembala/shared"
import type { AuthContext } from "../authz/auth-context"
import { ScopeService } from "../authz/scope.service"
import { MembersService } from "../members/members.service"
import { GroupsService } from "../groups/groups.service"
import { AttendanceService } from "../groups/attendance.service"
import { CareRequestsService } from "../care-requests/care-requests.service"
import { PastoralNotesService } from "../pastoral-notes/pastoral-notes.service"
import { ABSENCE_THRESHOLD, absenceItems, birthdaysWithin } from "../attention/attention"
import { TELEGRAM_TOOLS } from "./telegram-tools"

const HISTORY_LIMIT = 20 // last 10 user/assistant turns
const MAX_TOOL_ROUNDS = 6

const BIRTHDAY_DEFAULT_DAYS = 7
const BIRTHDAY_MAX_DAYS = 60
const CARE_LIST_LIMIT = 30
const CARE_BODY_PREVIEW = 280

const SYSTEM_PROMPT = `You are gembala's assistant for church leaders, reachable via Telegram. You can:
- Look up members and small groups (scoped to the caller's access)
- Add a new member
- List a group's past sessions
- Log a new session with who was present, who was excused (with a reason) and, implicitly, who was absent
- Create a new small group
- Update an existing small group (name, leader, scope tag, roster, schedule, location)
- Report who needs follow-up for missing 2+ sessions in a row (get_absence_report)
- List upcoming birthdays (get_birthdays)
- List prayer and care requests, and record a new one for a member
- Save a private pastoral note about a member (add_note); only the leader and church admins can read it

Confirm the details with the user before calling add_member, log_session, create_group, update_group, create_care_request, or add_note.
When logging a session, a member the leader says was "izin", sick or away for a reason is excused (put the reason in excused), not absent.
If a tool returns an error saying a permission is missing, tell the user their role doesn't allow that.
For ambiguous member or group names, list the matches and ask which one.
Respond concisely. The user is a church leader messaging from Telegram.`

type ChatTurn = { role: "user" | "assistant"; content: string }

type OpenRouterToolCall = {
  id: string
  type: "function"
  function: { name: string; arguments: string }
}

type OpenRouterMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: OpenRouterToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string }

type OpenRouterResponse = {
  choices: {
    message: { role: "assistant"; content: string | null; tool_calls?: OpenRouterToolCall[] }
  }[]
}

@Injectable()
export class TelegramAgentService {
  private readonly logger = new Logger("TelegramAgent")
  private readonly apiKey?: string
  private readonly model: string
  private readonly history = new Map<string, ChatTurn[]>()

  constructor(
    private readonly config: ConfigService,
    private readonly members: MembersService,
    private readonly groups: GroupsService,
    private readonly attendance: AttendanceService,
    private readonly scope: ScopeService,
    private readonly pastoralNotes: PastoralNotesService,
    // CareRequestsService is resolved lazily: CareRequestsModule -> NotificationsModule
    // -> TelegramModule is already an import chain, so importing it here would be a cycle.
    private readonly moduleRef: ModuleRef,
  ) {
    this.apiKey = this.config.get<string>("OPENROUTER_API_KEY")
    this.model = this.config.get<string>("OPENROUTER_MODEL") ?? "anthropic/claude-sonnet-4.5"
  }

  get isConfigured(): boolean {
    return Boolean(this.apiKey)
  }

  async processMessage(auth: AuthContext, chatId: string, userText: string): Promise<string> {
    const history = this.history.get(chatId) ?? []
    const messages: OpenRouterMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history.map((h): OpenRouterMessage => ({ role: h.role, content: h.content })),
      { role: "user", content: userText },
    ]

    let reply = "Sorry, I couldn't process that."

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      let response: OpenRouterResponse
      try {
        response = await this.callOpenRouter(messages)
      } catch (err) {
        this.logger.error(`OpenRouter request failed: ${err instanceof Error ? err.message : String(err)}`)
        return "Sorry, something went wrong. Please try again."
      }

      const message = response.choices?.[0]?.message
      if (!message) break

      if (!message.tool_calls || message.tool_calls.length === 0) {
        reply = message.content ?? reply
        break
      }

      messages.push({ role: "assistant", content: message.content, tool_calls: message.tool_calls })

      for (const call of message.tool_calls) {
        const result = await this.dispatchTool(auth, call.function.name, call.function.arguments)
        messages.push({ role: "tool", tool_call_id: call.id, content: result })
      }
    }

    history.push({ role: "user", content: userText })
    history.push({ role: "assistant", content: reply })
    if (history.length > HISTORY_LIMIT) history.splice(0, history.length - HISTORY_LIMIT)
    this.history.set(chatId, history)

    return reply
  }

  private async callOpenRouter(messages: OpenRouterMessage[]): Promise<OpenRouterResponse> {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ model: this.model, messages, tools: TELEGRAM_TOOLS }),
    })
    if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`)
    return (await res.json()) as OpenRouterResponse
  }

  private get careRequests(): CareRequestsService {
    return this.moduleRef.get(CareRequestsService, { strict: false })
  }

  // Same rule as PermissionsGuard on the HTTP routes these tools mirror.
  private requirePermission(auth: AuthContext, resource: PermissionResource, action: PermissionAction): void {
    const key = permissionKey(resource, action)
    if (!auth.isSystemAdmin && !auth.permissions.has(key)) {
      throw new ForbiddenException(`missing permission: ${key}`)
    }
  }

  // Tool-call entry point; exposed for unit tests.
  async dispatchTool(auth: AuthContext, name: string, argsJson: string): Promise<string> {
    try {
      const args = JSON.parse(argsJson || "{}") as Record<string, unknown>
      switch (name) {
        case "list_members":
          return JSON.stringify(
            await this.members.list(auth, args.q as string | undefined, args.tag as string | undefined),
          )
        case "get_member": {
          const nameOrId = (args.name_or_id as string) ?? ""
          if (/^[0-9a-f-]{36}$/i.test(nameOrId)) {
            return JSON.stringify(await this.members.detail(auth, nameOrId))
          }
          return JSON.stringify(await this.members.list(auth, nameOrId))
        }
        case "add_member":
          return JSON.stringify(
            await this.members.create(auth, {
              name: args.name as string,
              email: (args.email as string) ?? "",
              phone: (args.phone as string) ?? "",
              tags: (args.tags as string[]) ?? [],
              status: (args.status as "active" | "newcomer" | "inactive" | "moved") ?? "active",
              address: "",
              occupation: "",
              notes: "",
              photoUrl: "",
            }),
          )
        case "list_groups":
          return JSON.stringify(await this.groups.list(auth))
        case "list_sessions": {
          const groupId = args.group_id as string
          await this.groups.requireVisibleGroup(auth, groupId)
          return JSON.stringify(await this.groups.sessionsForGroup(groupId))
        }
        case "create_group":
          return JSON.stringify(
            await this.groups.create(auth, {
              name: args.name as string,
              leaderId: args.leader_id as string,
              scopeTag: args.scope_tag as string,
              memberIds: (args.member_ids as string[]) ?? [],
              schedule: (args.schedule as string) ?? "",
              location: (args.location as string) ?? "",
            }),
          )
        case "update_group": {
          const groupId = args.group_id as string
          return JSON.stringify(
            await this.groups.update(auth, groupId, {
              ...(args.name !== undefined ? { name: args.name as string } : {}),
              ...(args.leader_id !== undefined ? { leaderId: args.leader_id as string } : {}),
              ...(args.scope_tag !== undefined ? { scopeTag: args.scope_tag as string } : {}),
              ...(args.member_ids !== undefined ? { memberIds: args.member_ids as string[] } : {}),
              ...(args.schedule !== undefined ? { schedule: args.schedule as string } : {}),
              ...(args.location !== undefined ? { location: args.location as string } : {}),
            }),
          )
        }
        case "log_session": {
          const groupId = args.group_id as string
          const excusedArg = Array.isArray(args.excused) ? (args.excused as Record<string, unknown>[]) : []
          const input = parseArgs(sessionCreateSchema, {
            date: args.date,
            topic: (args.topic as string) ?? "",
            presentIds: (args.present_member_ids as string[]) ?? [],
            excused: excusedArg.map((e) => ({ memberId: e?.member_id, reason: e?.reason ?? "" })),
            prayerNotes: "",
          })
          return JSON.stringify(await this.attendance.logSession(auth, groupId, input))
        }
        case "get_absence_report":
          this.requirePermission(auth, "groups", "read")
          return JSON.stringify(await this.absenceReport(auth, args.group_id as string | undefined))
        case "get_birthdays":
          this.requirePermission(auth, "members", "read")
          return JSON.stringify(await this.birthdays(auth, clampDays(args.days)))
        case "list_care_requests": {
          this.requirePermission(auth, "care_requests", "read")
          const filters = parseArgs(careListArgsSchema, args)
          const rows = await this.careRequests.list(auth, {
            ...(filters.status !== "all" ? { status: filters.status } : {}),
            ...(filters.type ? { type: filters.type } : {}),
            ...(filters.member_id ? { memberId: filters.member_id } : {}),
            ...(filters.assigned_to_me ? { assignedToUserId: "me" } : {}),
            ...(filters.overdue_only ? { overdue: true } : {}),
          })
          return JSON.stringify({
            total: rows.length,
            shown: Math.min(rows.length, CARE_LIST_LIMIT),
            requests: rows.slice(0, CARE_LIST_LIMIT).map(careSummary),
          })
        }
        case "create_care_request": {
          this.requirePermission(auth, "care_requests", "create")
          const input = parseArgs(careRequestCreateSchema, {
            memberId: args.member_id,
            type: args.type,
            body: args.body,
            ...(args.due_at ? { dueAt: args.due_at } : {}),
          })
          return JSON.stringify(careSummary(await this.careRequests.create(auth, input)))
        }
        case "add_note": {
          const input = parseArgs(addNoteArgsSchema, args)
          // The service enforces members:update, tag scope and body length.
          const note = await this.pastoralNotes.create(auth, input.member_id, input.body, "telegram")
          // The body is not echoed back: the model already has it.
          return JSON.stringify({ id: note.id, memberId: note.memberId, createdAt: note.createdAt })
        }
        default:
          return JSON.stringify({ error: `Unknown tool ${name}` })
      }
    } catch (err) {
      return JSON.stringify({ error: err instanceof Error ? err.message : String(err) })
    }
  }

  // Mirrors DashboardService.summary's attendanceAlerts inputs (visible members,
  // visible groups, every session) and the shared `absenceItems` rule, so the
  // bot and the dashboard always flag the same people.
  private async absenceReport(auth: AuthContext, groupId?: string) {
    if (groupId) await this.groups.requireVisibleGroup(auth, groupId)
    const scope = await this.scope.expandedScope(auth)
    const visibleIds = new Set(
      (await this.members.orgMembersWithTags(auth.orgId))
        .filter((m) => this.scope.memberVisible(scope, m.tags))
        .map((m) => m.id),
    )
    const groups = (await this.groups.list(auth)).filter((g) => !groupId || g.id === groupId)
    const sessionsByGroup = new Map<string, SessionResponse[]>(
      await Promise.all(groups.map(async (g) => [g.id, await this.groups.sessionsForGroup(g.id)] as const)),
    )
    const members = absenceItems(groups, sessionsByGroup, visibleIds)
      .sort((a, b) => b.missed - a.missed || a.name.localeCompare(b.name))
      .map((i) => ({
        memberId: i.memberId,
        name: i.name,
        groupId: i.groupId,
        groupName: i.groupName,
        missedSessions: i.missed,
        lastSeen: i.lastSeen,
      }))
    return { threshold: ABSENCE_THRESHOLD, count: members.length, members }
  }

  // Same source and rule as the dashboard's upcoming birthdays.
  private async birthdays(auth: AuthContext, days: number) {
    const scope = await this.scope.expandedScope(auth)
    const visible = (await this.members.orgMembersWithTags(auth.orgId)).filter((m) =>
      this.scope.memberVisible(scope, m.tags),
    )
    const today = todayInZone()
    return {
      today,
      days,
      birthdays: birthdaysWithin(visible, today, days).map((b) => ({
        memberId: b.memberId,
        name: b.name,
        date: b.date,
        dateOfBirth: b.dateOfBirth,
        daysUntil: b.daysUntil,
      })),
    }
  }
}

const careListArgsSchema = z.object({
  status: z.union([careRequestStatusSchema, z.literal("all")]).default("open"),
  type: careRequestTypeSchema.optional(),
  member_id: z.string().uuid().optional(),
  assigned_to_me: z.boolean().optional(),
  overdue_only: z.boolean().optional(),
})

// Validation failures go back to the model as a readable error string.
const addNoteArgsSchema = z.object({ member_id: z.string().uuid(), body: z.string() })

function parseArgs<T extends z.ZodTypeAny>(schema: T, value: unknown): z.output<T> {
  const parsed = schema.safeParse(value)
  if (parsed.success) return parsed.data
  const issues = parsed.error.issues.map((i) => `${i.path.join(".") || "arguments"}: ${i.message}`)
  throw new Error(`invalid arguments: ${issues.join("; ")}`)
}

export function clampDays(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : value
  if (typeof n !== "number" || !Number.isFinite(n)) return BIRTHDAY_DEFAULT_DAYS
  return Math.min(BIRTHDAY_MAX_DAYS, Math.max(1, Math.round(n)))
}

function careSummary(r: CareRequestResponse) {
  return {
    id: r.id,
    memberId: r.memberId,
    memberName: r.memberName,
    type: r.type,
    status: r.status,
    summary: r.body.length > CARE_BODY_PREVIEW ? `${r.body.slice(0, CARE_BODY_PREVIEW)}…` : r.body,
    owner: r.assignedTo?.name ?? null,
    dueAt: r.dueAt,
    overdue: r.overdue,
    createdAt: r.createdAt.slice(0, 10),
  }
}
