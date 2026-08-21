# Telegram AI Bot (Query + Attendance) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A linked Telegram user can ask the bot in natural language to look up members/groups and log small-group attendance, answered by an OpenRouter-backed tool-calling loop that calls the same `apps/api` services the web app uses — one process, no second bot, no schema changes.

**Architecture:** `TelegramService.handleUpdate` gets a third branch (alongside existing `/start` and `/link`): free text from a linked chat is handed to a new `TelegramAgentService`, which runs an OpenAI-compatible tool-calling loop against OpenRouter and dispatches tool calls straight into `MembersService`/`GroupsService`/`AttendanceService`. Resolving the caller's `AuthContext` from a Telegram chat (no JWT available) reuses logic extracted out of `JwtAuthGuard` into a new `AuthContextService`.

**Tech Stack:** NestJS 11, Drizzle ORM, OpenRouter's OpenAI-compatible `chat/completions` endpoint via plain `fetch` (no SDK, matching the existing Telegram Bot API integration style).

**Spec:** `docs/superpowers/specs/2026-08-21-telegram-ai-bot-query-attendance-design.md`

## Global Constraints

- `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` are optional env vars — unset means free-text messages to the bot get a fixed "AI assistant isn't configured yet" reply, not a crash.
- No new database schema. Every tool call is backed by an existing service (`MembersService`, `GroupsService`, `AttendanceService`) called with a real `AuthContext`, so scope/visibility rules are enforced exactly as they are for the web app — never reimplemented in the tool layer.
- No test framework exists in this repo (confirmed in the prior Telegram-link plan). Every task is verified manually via curl and, where a real key isn't available, by confirming the "not configured" fallback path.
- **`OPENROUTER_API_KEY` is not available during implementation** (not set in this environment). Task 4's verification proves the wiring and the graceful-fallback path end-to-end; it cannot prove live tool-calling correctness. That needs a manual pass from whoever adds a real key — call this out plainly, don't claim more than was actually verified.

---

### Task 1: Extract `AuthContextService` from `JwtAuthGuard`

**Files:**
- Create: `apps/api/src/authz/auth-context.service.ts`
- Modify: `apps/api/src/authz/jwt-auth.guard.ts`
- Modify: `apps/api/src/authz/authz.module.ts`

**Interfaces:**
- Produces: `AuthContextService.load(userId: string): Promise<AuthContext | null>` — used by `JwtAuthGuard` (this task) and `TelegramService` (Task 4).

- [ ] **Step 1: Create the service**

Create `apps/api/src/authz/auth-context.service.ts`:

```ts
import { Injectable } from "@nestjs/common"
import { eq } from "drizzle-orm"
import { InjectDb, type Db } from "../db/drizzle.module"
import { membershipScopeTags, organizations, orgMemberships, tags, users } from "../db/schema"
import type { AuthContext } from "./auth-context"

@Injectable()
export class AuthContextService {
  constructor(@InjectDb() private readonly db: Db) {}

  // Role and scope are read fresh from the DB every call (never cached in a
  // token), so permission changes take effect immediately. Shared by
  // JwtAuthGuard (keyed off a verified JWT's subject) and TelegramService
  // (keyed off a linked Telegram chat's userId — no JWT involved at all).
  async load(userId: string): Promise<AuthContext | null> {
    const rows = await this.db
      .select({
        userId: users.id,
        userName: users.name,
        userEmail: users.email,
        membershipId: orgMemberships.id,
        role: orgMemberships.role,
        roleLabel: orgMemberships.roleLabel,
        orgId: organizations.id,
        orgName: organizations.name,
      })
      .from(users)
      .innerJoin(orgMemberships, eq(orgMemberships.userId, users.id))
      .innerJoin(organizations, eq(organizations.id, orgMemberships.orgId))
      .where(eq(users.id, userId))
      .limit(1)

    const row = rows[0]
    if (!row) return null

    let scopeTagNames: string[] | null = null
    if (row.role !== "admin") {
      const scopeRows = await this.db
        .select({ name: tags.name })
        .from(membershipScopeTags)
        .innerJoin(tags, eq(tags.id, membershipScopeTags.tagId))
        .where(eq(membershipScopeTags.membershipId, row.membershipId))
      scopeTagNames = scopeRows.map((r) => r.name)
    }

    return { ...row, scopeTagNames }
  }
}
```

- [ ] **Step 2: Register it in `AuthzModule`**

Replace the contents of `apps/api/src/authz/authz.module.ts`:

```ts
import { Global, Module } from "@nestjs/common"
import { AuthContextService } from "./auth-context.service"
import { ScopeService } from "./scope.service"

@Global()
@Module({
  providers: [ScopeService, AuthContextService],
  exports: [ScopeService, AuthContextService],
})
export class AuthzModule {}
```

- [ ] **Step 3: Slim down `JwtAuthGuard` to use it**

Replace the contents of `apps/api/src/authz/jwt-auth.guard.ts`:

```ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common"
import { Reflector } from "@nestjs/core"
import { JwtService } from "@nestjs/jwt"
import type { Request } from "express"
import type { AuthContext } from "./auth-context"
import { AuthContextService } from "./auth-context.service"
import { IS_PUBLIC_KEY } from "./decorators"

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly authContext: AuthContextService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ])
    if (isPublic) return true

    const req = ctx.switchToHttp().getRequest<Request & { auth?: AuthContext }>()
    const header = req.headers.authorization
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined
    if (!token) throw new UnauthorizedException("missing bearer token")

    let payload: { sub: string }
    try {
      payload = await this.jwt.verifyAsync<{ sub: string }>(token)
    } catch {
      throw new UnauthorizedException("invalid or expired token")
    }

    const auth = await this.authContext.load(payload.sub)
    if (!auth) throw new UnauthorizedException("user no longer exists")

    req.auth = auth
    return true
  }
}
```

- [ ] **Step 4: Build and regression-check with the running dev server**

Run: `pnpm --filter @gembala/api build`
Expected: exits 0.

With the dev server running (it auto-restarts on save — confirm via `lsof -i :3000 -sTCP:LISTEN`, wait a few seconds after saving for the restart), verify login and an authenticated call still work exactly as before:

```bash
curl -s -X POST http://localhost:3000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"pastor.david@gembala.dev","password":"password123"}' | tee /tmp/login.json
TOKEN=$(node -e "console.log(require('/tmp/login.json').token)")
curl -s http://localhost:3000/api/members -H "Authorization: Bearer $TOKEN" | head -c 200
```

Expected: login returns a token as before, `/api/members` returns the member list as before (unauthenticated request without the header should still 401 — spot check with `curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/api/members`, expect `401`).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/authz/auth-context.service.ts apps/api/src/authz/jwt-auth.guard.ts apps/api/src/authz/authz.module.ts
git commit -m "refactor(api): extract AuthContextService from JwtAuthGuard"
```

---

### Task 2: OpenRouter env vars + tool definitions

**Files:**
- Modify: `apps/api/src/config/env.ts`
- Modify: `apps/api/.env.example`
- Create: `apps/api/src/telegram/telegram-tools.ts`
- Modify: `apps/api/src/groups/groups.module.ts`

**Interfaces:**
- Produces: `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` env vars; `TELEGRAM_TOOLS` (OpenAI-shaped tool array) — used by Task 3. `GroupsModule` now exports `AttendanceService` — used by Task 3/4.

- [ ] **Step 1: Add the env vars**

In `apps/api/src/config/env.ts`, add to `envSchema` (after the existing `TELEGRAM_*` fields):

```ts
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().optional(),
```

- [ ] **Step 2: Document them in `.env.example`**

Append to `apps/api/.env.example`:

```
# Optional: OpenRouter-backed AI assistant for the Telegram bot. Leave unset
# to disable — linked users get a fixed "not configured yet" reply instead.
# OPENROUTER_API_KEY=
# OPENROUTER_MODEL=anthropic/claude-sonnet-4.5
```

- [ ] **Step 3: Write the tool definitions**

Create `apps/api/src/telegram/telegram-tools.ts`:

```ts
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
```

- [ ] **Step 4: Export `AttendanceService` from `GroupsModule`**

In `apps/api/src/groups/groups.module.ts`, change:

```ts
  exports: [GroupsService],
```

to:

```ts
  exports: [GroupsService, AttendanceService],
```

- [ ] **Step 5: Type-check**

Run: `pnpm --filter @gembala/api build`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/config/env.ts apps/api/.env.example apps/api/src/telegram/telegram-tools.ts apps/api/src/groups/groups.module.ts
git commit -m "feat(api): add OpenRouter env config and Telegram bot tool definitions"
```

---

### Task 3: `TelegramAgentService`

**Files:**
- Create: `apps/api/src/telegram/telegram-agent.service.ts`

**Interfaces:**
- Consumes: `TELEGRAM_TOOLS` (Task 2); `MembersService`, `GroupsService`, `AttendanceService`; `AuthContext` from `../authz/auth-context`.
- Produces: `TelegramAgentService` with `isConfigured: boolean` and `processMessage(auth: AuthContext, chatId: string, userText: string): Promise<string>` — used by Task 4 (`TelegramService`).

- [ ] **Step 1: Write the service**

Create `apps/api/src/telegram/telegram-agent.service.ts`:

```ts
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

Confirm the member list with the user before calling log_session.
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

      const message = response.choices[0]?.message
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
```

- [ ] **Step 2: Type-check**

Run: `pnpm --filter @gembala/api build`
Expected: exits 0. (Not wired into a module yet, but `nest build` compiles the whole `src` tree so it must type-check standalone.)

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/telegram/telegram-agent.service.ts
git commit -m "feat(api): add TelegramAgentService (OpenRouter tool-calling loop)"
```

---

### Task 4: Wire the agent into `TelegramService`, verify end-to-end

**Files:**
- Modify: `apps/api/src/telegram/telegram.service.ts`
- Modify: `apps/api/src/telegram/telegram.module.ts`

**Interfaces:**
- Consumes: `TelegramAgentService` (Task 3), `AuthContextService` (Task 1).
- Produces: free-text messages from linked chats now reach the AI assistant path.

- [ ] **Step 1: Update `TelegramModule`**

Replace the contents of `apps/api/src/telegram/telegram.module.ts`:

```ts
import { Module } from "@nestjs/common"
import { MembersModule } from "../members/members.module"
import { GroupsModule } from "../groups/groups.module"
import { TelegramController } from "./telegram.controller"
import { TelegramService } from "./telegram.service"
import { TelegramAgentService } from "./telegram-agent.service"

@Module({
  imports: [MembersModule, GroupsModule],
  controllers: [TelegramController],
  providers: [TelegramService, TelegramAgentService],
})
export class TelegramModule {}
```

- [ ] **Step 2: Update `TelegramService`**

In `apps/api/src/telegram/telegram.service.ts`:

Add imports (alongside the existing ones):

```ts
import { AuthContextService } from "../authz/auth-context.service"
import { TelegramAgentService } from "./telegram-agent.service"
```

Add both to the constructor:

```ts
  constructor(
    @InjectDb() private readonly db: Db,
    private readonly config: ConfigService,
    private readonly authContext: AuthContextService,
    private readonly agent: TelegramAgentService,
  ) {
```

Replace the `handleUpdate` method:

```ts
  async handleUpdate(update: TelegramUpdate): Promise<void> {
    const message = update.message
    if (!message?.text) return

    const chatId = String(message.chat.id)
    const username = message.from?.username ?? null
    const text = message.text.trim()

    if (text === "/start") {
      await this.reply(
        chatId,
        "Welcome! Open Integrations in Gembala and send me /link <code> to connect your account.",
      )
      return
    }

    const linkMatch = /^\/link\s+(\S+)$/i.exec(text)
    if (linkMatch) {
      await this.consumeCode(chatId, username, linkMatch[1].toUpperCase())
      return
    }

    await this.handleFreeText(chatId, text)
  }

  private async handleFreeText(chatId: string, text: string): Promise<void> {
    const [link] = await this.db
      .select({ userId: telegramLinks.userId })
      .from(telegramLinks)
      .where(and(eq(telegramLinks.telegramChatId, chatId), isNull(telegramLinks.revokedAt)))
      .limit(1)

    if (!link) {
      await this.reply(
        chatId,
        "Your Telegram account isn't linked yet. Send /link <code> from the Integrations page to connect it.",
      )
      return
    }

    if (!this.agent.isConfigured) {
      await this.reply(chatId, "The AI assistant isn't configured yet.")
      return
    }

    const auth = await this.authContext.load(link.userId)
    if (!auth) {
      await this.reply(chatId, "Sorry, something went wrong. Please try again.")
      return
    }

    const reply = await this.agent.processMessage(auth, chatId, text)
    await this.reply(chatId, reply, { markdown: true })
  }
```

Replace the `reply` method to accept the new options parameter:

```ts
  private async reply(chatId: string, text: string, opts?: { markdown?: boolean }): Promise<void> {
    if (!this.token) return
    await fetch(`https://api.telegram.org/bot${this.token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        ...(opts?.markdown ? { parse_mode: "Markdown" } : {}),
      }),
    })
  }
```

- [ ] **Step 3: Type-check**

Run: `pnpm --filter @gembala/api build`
Expected: exits 0.

- [ ] **Step 4: Verify end-to-end (with `OPENROUTER_API_KEY` unset)**

With the dev server running (auto-restarts on save), and `TELEGRAM_WEBHOOK_SECRET` set to a temp value for testing (same approach as the link-flow plan — append `TELEGRAM_WEBHOOK_SECRET=test123` to `apps/api/.env`, spin a throwaway instance on a spare port with `PORT=3010 pnpm exec nest start` from `apps/api` if the auto-reloaded main instance hasn't picked up the `.env` change, since dotenv is only read at process start):

```bash
BASE=http://localhost:3010/api  # or :3000 if that instance already has the secret loaded

# 1. Free text from an unlinked chat
curl -s -X POST $BASE/telegram/webhook/test123 -H 'Content-Type: application/json' \
  -d '{"message":{"text":"how many members do we have?","chat":{"id":9001},"from":{"username":"unlinked_tester"}}}'
# Expected: {"ok":true} — check the bot's reply was sent by inspecting server logs
# (no token configured in this sandbox, so sendMessage itself won't fire, but
# handleFreeText's branch executed — confirmed by no server error and a clean 200).

# 2. Link a fresh test chat via a real code
TOKEN=$(node -e "console.log(require('/tmp/login.json').token)")  # reuse from Task 1 login
curl -s $BASE/telegram/link -H "Authorization: Bearer $TOKEN" | tee /tmp/tglink3.json
CODE=$(node -e "console.log(require('/tmp/tglink3.json').code)")
curl -s -X POST $BASE/telegram/webhook/test123 -H 'Content-Type: application/json' \
  -d "{\"message\":{\"text\":\"/link $CODE\",\"chat\":{\"id\":9002},\"from\":{\"username\":\"linked_tester\"}}}"
# Expected: {"ok":true}

# 3. Free text from the now-linked chat, OPENROUTER_API_KEY unset
curl -s -X POST $BASE/telegram/webhook/test123 -H 'Content-Type: application/json' \
  -d '{"message":{"text":"how many members do we have?","chat":{"id":9002},"from":{"username":"linked_tester"}}}'
# Expected: {"ok":true}, and server logs show no OpenRouter call was attempted
# (TelegramAgentService.isConfigured was false, short-circuited before fetch).
```

Confirm via server logs (`tail` the terminal running the dev server, or the
`/tmp/api-verify*.log` if using a throwaway instance) that step 3 did not log
an "OpenRouter request failed" line — that would mean it tried to call out
despite being unconfigured, which is the one failure mode worth checking by
hand here.

Then clean up: unlink the test chat (`curl -s -X DELETE $BASE/telegram/link -H "Authorization: Bearer $TOKEN"`), stop any throwaway instance, and revert the temporary `TELEGRAM_WEBHOOK_SECRET` line in `apps/api/.env` if one was added.

**Note for the user:** this proves the routing, linking gate, and graceful "not configured" fallback all work. It does **not** prove the OpenRouter tool-calling loop itself produces correct answers — that needs a real `OPENROUTER_API_KEY` and a manual conversation test once one is available.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/telegram/telegram.service.ts apps/api/src/telegram/telegram.module.ts
git commit -m "feat(api): route linked Telegram chats' free text through the AI agent"
```

---

### Task 5: Remove `mcp-server/`

**Files:**
- Delete: `mcp-server/` (entire directory)

**Interfaces:**
- None — `mcp-server` is not a pnpm workspace member (`pnpm-workspace.yaml` only globs `apps/*` and `packages/*`), so this is a self-contained deletion with no config changes elsewhere.

- [ ] **Step 1: Confirm nothing outside `mcp-server/` references it**

Run: `grep -rn "mcp-server" --include="*.json" --include="*.ts" --include="*.md" . --exclude-dir=node_modules --exclude-dir=mcp-server --exclude-dir=.git`
Expected: no output (or only unrelated doc mentions — read any hits before proceeding).

- [ ] **Step 2: Remove it**

```bash
git rm -r mcp-server
```

- [ ] **Step 3: Verify the rest of the monorepo still builds**

Run: `pnpm --filter @gembala/api build && pnpm --filter @gembala/web build`
Expected: both exit 0 — confirms nothing else depended on `mcp-server`.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: remove mcp-server, superseded by apps/api's Telegram AI agent"
```

---

## Plan Self-Review

**Spec coverage:** Architecture (Tasks 1, 4), all 5 tools with exact backing calls (Task 2 definitions, Task 3 dispatch), OpenRouter env + fetch-based integration (Tasks 2-3), conversation history cap (Task 3), `GroupsModule` export fix (Task 2), `mcp-server` removal (Task 5), error handling for unconfigured/failed/tool-throw cases (Task 3's `dispatchTool` try/catch and `processMessage` catch, exercised in Task 4's verification).

**Placeholder scan:** none — every step has runnable code or an exact command. Task 4's verification is explicit about what it does and does not prove (no real `OPENROUTER_API_KEY` available), rather than papering over the gap.

**Type consistency:** `AuthContextService.load` (Task 1) is the exact same signature/return type used in Task 4's `TelegramService.handleFreeText`. `TelegramAgentService.processMessage(auth, chatId, userText)` (Task 3) matches its call site in Task 4 field-for-field. `TELEGRAM_TOOLS` (Task 2) tool names (`list_members`, `get_member`, `list_groups`, `list_sessions`, `log_session`) match the `switch` cases in `dispatchTool` (Task 3) exactly.
