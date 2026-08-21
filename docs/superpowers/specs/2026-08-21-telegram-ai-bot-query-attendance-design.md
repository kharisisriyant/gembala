# Telegram AI Bot — Query & Attendance — Design

Status: Approved for planning
Date: 2026-08-21

## Context

`mcp-server/` already implements a Claude-powered Telegram bot (agentic tool-use
loop over `list_members`, `get_member`, `list_sessions`, `create_session`,
`record_attendance`, `add_pastoral_note`, `get_absence_report`, `get_birthdays`)
as a standalone Node process, polling Telegram and calling a legacy Next.js
app's `/api/internal/*` routes over HTTP.

That legacy Next.js app (`src/`) has since been deleted from the repo (commit
`c7d44ce`, landed independently of this work) in favor of `apps/web` +
`apps/api`. `mcp-server` is now fully orphaned — its target API no longer
exists. Separately, [[2026-08-21-telegram-bot-link-design]] added a minimal
webhook-based link/unlink flow directly to `apps/api`, using long-polling's
alternative: a registered webhook. A bot can only use one delivery mechanism
at a time, so `mcp-server`'s polling and `apps/api`'s webhook cannot coexist
on the same bot token regardless.

This spec ports a first, self-contained slice of `mcp-server`'s capability —
querying members/groups and logging attendance via chat — directly into
`apps/api`, and retires `mcp-server` entirely. Three more slices (pastoral
notes, birthdays, absence/follow-up reporting) are explicitly deferred; each
needs new schema and/or business rules that don't exist anywhere in this
codebase today (the original implementation was never committed).

## Goals

- A linked user can ask the Telegram bot to look up members/groups and log
  attendance for a session, in natural language, and get correct, scope-
  respecting answers.
- All bot logic runs inside `apps/api` as one process, using the same
  webhook already registered for linking — no second bot process, no
  polling/webhook conflict.
- The bot's tools are backed by the same services (`MembersService`,
  `GroupsService`, `AttendanceService`) the web app uses, so org/scope
  enforcement is identical by construction, not reimplemented.
- Model access goes through OpenRouter, not a direct Anthropic API key.

## Non-goals

- Pastoral notes, birthday tracking/digest, absence/follow-up reporting —
  each needs new schema or business rules not established anywhere in the
  current codebase; deferred to separate specs.
- Persistent conversation history across restarts (in-memory only, matching
  `mcp-server`'s original design and its own noted limitation).
- Streaming responses, multi-message chunking for long replies, or any
  Telegram UX beyond plain-text/Markdown replies.

## Architecture

`TelegramService.handleUpdate` (from the link-flow spec) already branches on
`/start` and `/link <code>`. This adds a third branch: any other text from a
chat with an active link is handed to a new `TelegramAgentService`, which
runs an OpenRouter-backed tool-calling loop and returns a reply string.
Unlinked chats sending free text get the existing "link your account first"
message; linked chats get the existing "AI assistant isn't configured yet"
message if `OPENROUTER_API_KEY` is unset.

Resolving *which* user a chat belongs to (and their org/scope) currently
only happens inside `JwtAuthGuard`, keyed off a JWT. The bot has no JWT —
only a `telegramChatId` → `telegram_links.userId` lookup. Rather than
duplicate `JwtAuthGuard`'s DB query, its `loadAuthContext` logic moves into a
new `AuthContextService` (in `authz/`, already a `@Global()` module) that
both the guard and `TelegramAgentService` call.

```
Telegram → apps/api webhook → TelegramService.handleUpdate
  ├─ /start, /link <code>        → existing logic, unchanged
  └─ other text, chat is linked  → AuthContextService.loadAuthContext(userId)
                                     → TelegramAgentService.processMessage(auth, text)
                                          → OpenRouter chat/completions (tool loop)
                                          → MembersService / GroupsService / AttendanceService
                                     → reply text → Telegram sendMessage
```

## Tools

Five tools, trimmed and reshaped from `mcp-server`'s original seven to what
`apps/api`'s actual data model supports:

| Tool | Backing call | Notes |
|---|---|---|
| `list_members(q?, tag?)` | `MembersService.list(auth, q, tag)` | drops the original's `type` filter — no such field in `apps/api`'s member model |
| `get_member(name_or_id)` | `MembersService.detail` (UUID) or `.list` (name, for disambiguation) | same UUID-vs-name branch as the original |
| `list_groups()` | `GroupsService.list(auth)` | **new** — not in the original tool set, but necessary: nothing else lets the agent resolve a group name to an ID |
| `list_sessions(group_id)` | `GroupsService.sessionsForGroup`, scope-checked via `requireVisibleGroup` | |
| `log_session(group_id, date, topic?, present_member_ids)` | `AttendanceService.logSession` | replaces the original's separate `create_session` + `record_attendance` with per-member present/absent/excused status — `apps/api` and the web UI only ever support one combined present-list per session, so the tool matches that, not the richer original design |

Every tool call runs with the `AuthContext` resolved for the linked user, so
scope filtering (which members/groups are visible, which groups can be
written to) is identical to what that same user sees in the web app —
enforced by the underlying services, not reimplemented in the tool layer.

## OpenRouter integration

Plain `fetch` to `https://openrouter.ai/api/v1/chat/completions` — no SDK
dependency, matching how `TelegramService` already calls the Telegram Bot
API directly. OpenRouter's API is OpenAI-compatible, so tool calling uses
OpenAI's shape: request `tools: [{type: "function", function: {name,
description, parameters}}]`, response `message.tool_calls[]` with
`function.name` / `function.arguments` (a JSON string to parse), and results
fed back as `{role: "tool", tool_call_id, content}` messages — not
Anthropic's `tool_use`/`tool_result` blocks, which is what `mcp-server`'s
`agent.ts` used.

### Env (`apps/api/src/config/env.ts`)

Both optional, following the same pattern as the Telegram vars:

- `OPENROUTER_API_KEY` — unset means free-text messages get a fixed "AI
  assistant isn't configured yet" reply instead of calling out to OpenRouter.
- `OPENROUTER_MODEL` — defaults to `anthropic/claude-sonnet-4.5`. OpenRouter
  fronts many providers under one API; no reason to hardcode a single model.

## Conversation history

In-memory `Map<telegramChatId, Message[]>` inside `TelegramAgentService`,
capped at the last 10 turns (20 messages) — same approach and same limit
`mcp-server` used. Lost on process restart; not fixing that now (matches the
original's own accepted limitation, not a regression).

## Supporting changes

- `GroupsModule` currently exports `GroupsService` but not `AttendanceService`
  — needs `AttendanceService` added to its `exports` array so `TelegramModule`
  can inject it for `log_session`.
- `TelegramModule` needs `MembersModule` and `GroupsModule` in its `imports`.
- `mcp-server/` is deleted (`git rm -r mcp-server`). It is not a pnpm
  workspace member (`pnpm-workspace.yaml` only globs `apps/*` and
  `packages/*`), so removal is self-contained — no workspace config changes
  needed.

## Error handling

- `OPENROUTER_API_KEY` unset → fixed reply, no outbound call attempted.
- OpenRouter request fails (network, rate limit, non-2xx) → caught, user
  gets "Sorry, something went wrong. Please try again." (matches
  `mcp-server`'s existing catch-all behavior), error logged server-side.
- Tool dispatch throws (e.g., `NotFoundException` from a service for an
  out-of-scope group) → caught per-tool-call, fed back to the model as a
  `tool` message containing the error, same as `mcp-server`'s original
  per-tool try/catch — lets the model explain the failure conversationally
  instead of crashing the whole turn.
- Ambiguous member name (`list` returns multiple matches) → returned as-is
  to the model, which is prompted to ask the user to disambiguate (same
  system-prompt instruction `mcp-server` used).

## Testing

No test framework in this repo (established in the link-flow spec). Verified
by hand: curl simulating webhook messages for a linked test chat (list
members, look up a member, list a group's sessions, log a session with a
present-list) against a running `apps/api`, then a real round-trip once a
webhook is registered for the actual bot token.
