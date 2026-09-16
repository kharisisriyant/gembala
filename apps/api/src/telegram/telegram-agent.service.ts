import { Injectable, Logger } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import type { AuthContext } from "../authz/auth-context"
import { MembersService } from "../members/members.service"
import { GroupsService } from "../groups/groups.service"
import { AttendanceService } from "../groups/attendance.service"
import { TELEGRAM_TOOLS } from "./telegram-tools"

const HISTORY_LIMIT = 20 // last 10 user/assistant turns
const MAX_TOOL_ROUNDS = 6

const SYSTEM_PROMPT = `You are Gembala's assistant for church leaders, reachable via Telegram. You can:
- Look up members and small groups (scoped to the caller's access)
- List a group's past sessions
- Log a new session with who was present
- Create a new small group
- Update an existing small group (name, leader, scope tag, roster, schedule, location)

Confirm the details with the user before calling log_session, create_group, or update_group.
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

  private async dispatchTool(auth: AuthContext, name: string, argsJson: string): Promise<string> {
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
          return JSON.stringify(
            await this.attendance.logSession(auth, groupId, {
              date: args.date as string,
              topic: (args.topic as string) ?? "",
              presentIds: (args.present_member_ids as string[]) ?? [],
              prayerNotes: "",
            }),
          )
        }
        default:
          return JSON.stringify({ error: `Unknown tool ${name}` })
      }
    } catch (err) {
      return JSON.stringify({ error: err instanceof Error ? err.message : String(err) })
    }
  }
}
