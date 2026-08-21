# Telegram Bot Account Linking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let any logged-in Gembala user link their personal Telegram account by messaging a bot a one-time code, reachable from a real page in the currently-running `apps/web` + `apps/api` app.

**Architecture:** Two new Postgres tables (`telegram_link_codes`, `telegram_links`) back a new `TelegramModule` in `apps/api` (controller + service), following the existing `InvitesModule` pattern exactly. A public webhook endpoint receives Telegram's pushed messages; an authenticated pair of endpoints (`GET`/`DELETE /telegram/link`) drive the UI. `apps/web` gets a new page, a sidebar section visible to every logged-in user (not just admins), and two React Query hooks.

**Tech Stack:** NestJS 11, Drizzle ORM (Postgres), nestjs-zod, React 19 + React Router 7 + TanStack Query, shadcn/radix UI components, plain `fetch` to the Telegram Bot API (no SDK).

**Spec:** `docs/superpowers/specs/2026-08-21-telegram-bot-link-design.md`

## Global Constraints

- All new env vars (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_WEBHOOK_URL`) are optional — the app must boot and run identically with none of them set.
- Webhook path is `POST /api/telegram/webhook/:secret`, guarded only by matching `:secret` against `TELEGRAM_WEBHOOK_SECRET` (404 on mismatch) — no deeper signature verification (spec non-goal).
- One active link per user, one active link per Telegram chat — enforced by partial unique indexes (`revoked_at is null`), not application-level locking.
- `apps/web/src/pages/*.tsx` is a flat directory (see `invites.tsx`, `members.tsx`) — new page files go directly under `pages/`, not in a `pages/settings/` subfolder, even though the route path is `/settings/telegram`.
- **No test framework exists anywhere in this repo** (no jest/vitest config, no `*.spec.ts`/`*.test.ts` files in `apps/api` or `apps/web`). Adding one is out of scope for this feature. Every task below is verified manually (curl, `psql`, or the running browser app), matching how every other feature in this codebase is currently verified.

---

### Task 1: Database schema — `telegram_link_codes` and `telegram_links`

**Files:**
- Modify: `apps/api/src/db/schema.ts`

**Interfaces:**
- Produces: `telegramLinkCodes` table (`id`, `userId`, `code`, `expiresAt`, `createdAt`) and `telegramLinks` table (`id`, `userId`, `telegramChatId`, `telegramUsername`, `linkedAt`, `revokedAt`), both importable from `../db/schema` — used by Task 4.

- [ ] **Step 1: Add `sql` to the drizzle-orm import**

Find the top-level import block in `apps/api/src/db/schema.ts`:

```ts
import {
  type AnyPgColumn,
  date,
  index,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"
```

Add a second import line right below it:

```ts
import { sql } from "drizzle-orm"
```

- [ ] **Step 2: Append the two new tables**

Add this at the end of `apps/api/src/db/schema.ts` (after `passwordResetTokens`):

```ts
export const telegramLinkCodes = pgTable(
  "telegram_link_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    code: text("code").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("telegram_link_codes_user_idx").on(t.userId)],
)

export const telegramLinks = pgTable(
  "telegram_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    telegramChatId: text("telegram_chat_id").notNull(),
    telegramUsername: text("telegram_username"),
    linkedAt: timestamp("linked_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("telegram_links_user_active_uq").on(t.userId).where(sql`revoked_at is null`),
    uniqueIndex("telegram_links_chat_active_uq").on(t.telegramChatId).where(sql`revoked_at is null`),
  ],
)
```

- [ ] **Step 3: Generate the migration**

Run: `pnpm --filter @gembala/api db:generate`
Expected: a new `.sql` file appears under `apps/api/drizzle/`, containing `CREATE TABLE "telegram_link_codes"` and `CREATE TABLE "telegram_links"` with the two partial unique indexes.

- [ ] **Step 4: Apply the migration**

Run: `pnpm db:up` (starts Postgres if not already running), then `pnpm --filter @gembala/api db:migrate`
Expected: command exits 0. Verify with:
`docker compose exec -T db psql -U gembala -d gembala -c '\d telegram_links'`
Expected output lists `telegram_chat_id`, `revoked_at`, and the two unique indexes.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/db/schema.ts apps/api/drizzle/
git commit -m "feat(api): add telegram_link_codes and telegram_links tables"
```

---

### Task 2: Env config for the bot

**Files:**
- Modify: `apps/api/src/config/env.ts`
- Modify: `apps/api/.env.example`

**Interfaces:**
- Produces: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_WEBHOOK_URL` — all optional strings, readable via `ConfigService.get<string>(...)` in Task 4.

- [ ] **Step 1: Add the four optional fields to `envSchema`**

In `apps/api/src/config/env.ts`, change:

```ts
export const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default("7d"),
  PORT: z.coerce.number().default(3000),
  WEB_ORIGIN: z.string().url().default("http://localhost:5173"),
})
```

to:

```ts
export const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default("7d"),
  PORT: z.coerce.number().default(3000),
  WEB_ORIGIN: z.string().url().default("http://localhost:5173"),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_BOT_USERNAME: z.string().optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional(),
  TELEGRAM_WEBHOOK_URL: z.string().url().optional(),
})
```

- [ ] **Step 2: Document the new vars in `.env.example`**

Append to `apps/api/.env.example`:

```
# Optional: Telegram bot integration. Leave all four unset to disable the
# feature entirely — the app runs fine without them.
# TELEGRAM_BOT_TOKEN=
# TELEGRAM_BOT_USERNAME=
# TELEGRAM_WEBHOOK_SECRET=
# TELEGRAM_WEBHOOK_URL=
```

- [ ] **Step 3: Verify the app still boots with these unset**

Run: `pnpm --filter @gembala/api dev` (leave `apps/api/.env` untouched, no telegram vars set)
Expected: server starts on the configured `PORT` with no validation errors, same as before this change. Stop it after confirming (Ctrl+C).

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/config/env.ts apps/api/.env.example
git commit -m "feat(api): add optional Telegram bot env vars"
```

---

### Task 3: Shared response type

**Files:**
- Modify: `packages/shared/src/schemas.ts`

**Interfaces:**
- Produces: `TelegramLinkStatusResponse` (discriminated union on `linked`), importable from `@gembala/shared` — used by Task 4 (API) and Task 6 (web hooks).

- [ ] **Step 1: Append the type**

Add to the end of `packages/shared/src/schemas.ts`:

```ts
// ---------------------------------------------------------------------------
// Telegram
// ---------------------------------------------------------------------------

export type TelegramLinkStatusResponse =
  | { linked: true; telegramUsername: string | null }
  | {
      linked: false
      code: string
      expiresAt: string
      botConfigured: boolean
      botUsername: string | null
    }
```

- [ ] **Step 2: Build the package**

Run: `pnpm --filter @gembala/shared build`
Expected: exits 0, `packages/shared/dist/schemas.js` and `.d.ts` are updated (check `dist/schemas.d.ts` contains `TelegramLinkStatusResponse`).

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/schemas.ts packages/shared/dist
git commit -m "feat(shared): add TelegramLinkStatusResponse type"
```

---

### Task 4: `TelegramService`

**Files:**
- Create: `apps/api/src/telegram/telegram.service.ts`

**Interfaces:**
- Consumes: `Db` / `InjectDb` from `../db/drizzle.module`; `telegramLinkCodes`, `telegramLinks` from `../db/schema` (Task 1); `AuthContext` from `../authz/auth-context`; `TelegramLinkStatusResponse` from `@gembala/shared` (Task 3).
- Produces: `TelegramService` class with `getStatus(auth): Promise<TelegramLinkStatusResponse>`, `revoke(auth): Promise<void>`, `handleUpdate(update: TelegramUpdate): Promise<void>`, and the exported `TelegramUpdate` type — used by Task 5 (`TelegramController`).

- [ ] **Step 1: Write the service**

Create `apps/api/src/telegram/telegram.service.ts`:

```ts
import { Injectable, Logger, type OnModuleInit } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { randomBytes } from "node:crypto"
import { and, eq, gt, isNull } from "drizzle-orm"
import type { TelegramLinkStatusResponse } from "@gembala/shared"
import { InjectDb, type Db } from "../db/drizzle.module"
import { telegramLinkCodes, telegramLinks } from "../db/schema"
import type { AuthContext } from "../authz/auth-context"

const CODE_TTL_MS = 10 * 60 * 1000

export type TelegramUpdate = {
  message?: {
    text?: string
    chat: { id: number }
    from?: { username?: string }
  }
}

@Injectable()
export class TelegramService implements OnModuleInit {
  private readonly logger = new Logger("Telegram")
  private readonly token?: string
  private readonly botUsername?: string
  private readonly webhookSecret?: string
  private readonly webhookUrl?: string

  constructor(
    @InjectDb() private readonly db: Db,
    private readonly config: ConfigService,
  ) {
    this.token = this.config.get<string>("TELEGRAM_BOT_TOKEN")
    this.botUsername = this.config.get<string>("TELEGRAM_BOT_USERNAME")
    this.webhookSecret = this.config.get<string>("TELEGRAM_WEBHOOK_SECRET")
    this.webhookUrl = this.config.get<string>("TELEGRAM_WEBHOOK_URL")
  }

  get isConfigured(): boolean {
    return Boolean(this.token)
  }

  // Self-registers the webhook on boot when fully configured. Silent no-op
  // otherwise — the rest of the app must work with the bot absent.
  async onModuleInit(): Promise<void> {
    if (!this.token || !this.webhookUrl || !this.webhookSecret) {
      this.logger.log("Telegram bot not configured — skipping webhook registration")
      return
    }
    const target = `${this.webhookUrl}/api/telegram/webhook/${this.webhookSecret}`
    try {
      const res = await fetch(`https://api.telegram.org/bot${this.token}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: target }),
      })
      const data = (await res.json()) as { ok: boolean; description?: string }
      if (!data.ok) this.logger.warn(`setWebhook failed: ${data.description}`)
      else this.logger.log(`Telegram webhook registered at ${target}`)
    } catch (err) {
      this.logger.warn(`setWebhook request failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  async getStatus(auth: AuthContext): Promise<TelegramLinkStatusResponse> {
    const [link] = await this.db
      .select()
      .from(telegramLinks)
      .where(and(eq(telegramLinks.userId, auth.userId), isNull(telegramLinks.revokedAt)))
      .limit(1)

    if (link) {
      return { linked: true, telegramUsername: link.telegramUsername }
    }

    const [existing] = await this.db
      .select()
      .from(telegramLinkCodes)
      .where(and(eq(telegramLinkCodes.userId, auth.userId), gt(telegramLinkCodes.expiresAt, new Date())))
      .limit(1)

    const codeRow = existing ?? (await this.createCode(auth.userId))

    return {
      linked: false,
      code: codeRow.code,
      expiresAt: codeRow.expiresAt.toISOString(),
      botConfigured: this.isConfigured,
      botUsername: this.botUsername ?? null,
    }
  }

  async revoke(auth: AuthContext): Promise<void> {
    await this.db
      .update(telegramLinks)
      .set({ revokedAt: new Date() })
      .where(and(eq(telegramLinks.userId, auth.userId), isNull(telegramLinks.revokedAt)))
  }

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

    const match = /^\/link\s+(\S+)$/i.exec(text)
    if (!match) {
      await this.reply(chatId, "Send /link <code> from the Integrations page to connect your account.")
      return
    }

    await this.consumeCode(chatId, username, match[1].toUpperCase())
  }

  private async createCode(userId: string) {
    const code = randomBytes(4).toString("hex").toUpperCase()
    const expiresAt = new Date(Date.now() + CODE_TTL_MS)
    const [row] = await this.db.insert(telegramLinkCodes).values({ userId, code, expiresAt }).returning()
    return row
  }

  private async consumeCode(chatId: string, username: string | null, code: string): Promise<void> {
    const [alreadyLinked] = await this.db
      .select()
      .from(telegramLinks)
      .where(and(eq(telegramLinks.telegramChatId, chatId), isNull(telegramLinks.revokedAt)))
      .limit(1)
    if (alreadyLinked) {
      await this.reply(chatId, "This Telegram account is already linked.")
      return
    }

    const [codeRow] = await this.db
      .select()
      .from(telegramLinkCodes)
      .where(and(eq(telegramLinkCodes.code, code), gt(telegramLinkCodes.expiresAt, new Date())))
      .limit(1)
    if (!codeRow) {
      await this.reply(chatId, "That code is invalid or expired. Generate a new one from the Integrations page.")
      return
    }

    try {
      await this.db.insert(telegramLinks).values({
        userId: codeRow.userId,
        telegramChatId: chatId,
        telegramUsername: username,
      })
    } catch {
      // partial unique index on telegram_chat_id caught a race
      await this.reply(chatId, "This Telegram account is already linked to another user.")
      return
    }

    await this.db.delete(telegramLinkCodes).where(eq(telegramLinkCodes.id, codeRow.id))
    await this.reply(chatId, "Connected! Your Gembala account is now linked.")
  }

  private async reply(chatId: string, text: string): Promise<void> {
    if (!this.token) return
    await fetch(`https://api.telegram.org/bot${this.token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    })
  }
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm --filter @gembala/api build`
Expected: exits 0, no TypeScript errors (this file isn't wired into a module yet, but `nest build` compiles the whole `src` tree so it must type-check standalone).

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/telegram/telegram.service.ts
git commit -m "feat(api): add TelegramService (link codes, linking, webhook handling)"
```

---

### Task 5: `TelegramController`, `TelegramModule`, wire into `AppModule`

**Files:**
- Create: `apps/api/src/telegram/telegram.controller.ts`
- Create: `apps/api/src/telegram/telegram.module.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Consumes: `TelegramService` (Task 4), `CurrentAuth`/`Public` decorators from `../authz/decorators`, `AuthContext` from `../authz/auth-context`, `TelegramLinkStatusResponse` from `@gembala/shared`.
- Produces: live HTTP routes `GET /api/telegram/link`, `DELETE /api/telegram/link`, `POST /api/telegram/webhook/:secret`.

- [ ] **Step 1: Write the controller**

Create `apps/api/src/telegram/telegram.controller.ts`:

```ts
import { Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Post } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import type { TelegramLinkStatusResponse } from "@gembala/shared"
import { CurrentAuth, Public } from "../authz/decorators"
import type { AuthContext } from "../authz/auth-context"
import { TelegramService, type TelegramUpdate } from "./telegram.service"

@Controller("telegram")
export class TelegramController {
  constructor(
    private readonly telegram: TelegramService,
    private readonly config: ConfigService,
  ) {}

  @Get("link")
  status(@CurrentAuth() auth: AuthContext): Promise<TelegramLinkStatusResponse> {
    return this.telegram.getStatus(auth)
  }

  @HttpCode(204)
  @Delete("link")
  async unlink(@CurrentAuth() auth: AuthContext): Promise<void> {
    await this.telegram.revoke(auth)
  }

  @Public()
  @HttpCode(200)
  @Post("webhook/:secret")
  async webhook(@Param("secret") secret: string, @Body() update: TelegramUpdate): Promise<{ ok: true }> {
    const expected = this.config.get<string>("TELEGRAM_WEBHOOK_SECRET")
    if (!expected || secret !== expected) {
      throw new NotFoundException()
    }
    await this.telegram.handleUpdate(update)
    return { ok: true }
  }
}
```

- [ ] **Step 2: Write the module**

Create `apps/api/src/telegram/telegram.module.ts`:

```ts
import { Module } from "@nestjs/common"
import { TelegramController } from "./telegram.controller"
import { TelegramService } from "./telegram.service"

@Module({
  controllers: [TelegramController],
  providers: [TelegramService],
})
export class TelegramModule {}
```

- [ ] **Step 3: Register it in `AppModule`**

In `apps/api/src/app.module.ts`, add the import:

```ts
import { TelegramModule } from "./telegram/telegram.module"
```

and add `TelegramModule` to the `imports` array (after `InvitesModule`):

```ts
    InvitesModule,
    TelegramModule,
```

- [ ] **Step 4: Verify with the dev server running**

Run: `pnpm --filter @gembala/api dev` in one terminal. In another:

1. Log in to get a token (replace with a real seeded user):
   `curl -s -X POST http://localhost:3000/api/auth/login -H 'Content-Type: application/json' -d '{"email":"<seed-user-email>","password":"<seed-password>"}' | tee /tmp/login.json`
   Expected: JSON with a `token` field.
2. Check link status (unlinked):
   `TOKEN=$(node -e "console.log(require('/tmp/login.json').token)"); curl -s http://localhost:3000/api/telegram/link -H "Authorization: Bearer $TOKEN"`
   Expected: `{"linked":false,"code":"XXXXXXXX","expiresAt":"...","botConfigured":false,"botUsername":null}`. Note the `code`.
3. Simulate the Telegram webhook (no real bot token needed — this hits the handler directly):
   `curl -s -X POST http://localhost:3000/api/telegram/webhook/wrong-secret -H 'Content-Type: application/json' -d '{}'`
   Expected: 404 (webhook secret unset in `.env`, so any value is "wrong" — confirms the guard rejects when unconfigured).
4. Temporarily set `TELEGRAM_WEBHOOK_SECRET=test123` in `apps/api/.env`, restart the dev server, then:
   `curl -s -X POST http://localhost:3000/api/telegram/webhook/test123 -H 'Content-Type: application/json' -d '{"message":{"text":"/link <CODE-FROM-STEP-2>","chat":{"id":555},"from":{"username":"tester"}}}'`
   Expected: `{"ok":true}`.
5. Re-check link status with the same token:
   `curl -s http://localhost:3000/api/telegram/link -H "Authorization: Bearer $TOKEN"`
   Expected: `{"linked":true,"telegramUsername":"tester"}`.
6. Unlink: `curl -s -X DELETE http://localhost:3000/api/telegram/link -H "Authorization: Bearer $TOKEN" -w '\n%{http_code}\n'`
   Expected: `204`.
7. Revert `apps/api/.env` (remove the temporary `TELEGRAM_WEBHOOK_SECRET`) and stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/telegram/telegram.controller.ts apps/api/src/telegram/telegram.module.ts apps/api/src/app.module.ts
git commit -m "feat(api): expose telegram link/unlink/webhook endpoints"
```

---

### Task 6: Web query hooks

**Files:**
- Modify: `apps/web/src/lib/queries.ts`

**Interfaces:**
- Consumes: `apiFetch` from `./api`; `TelegramLinkStatusResponse` from `@gembala/shared` (Task 3).
- Produces: `useTelegramLink()`, `useUnlinkTelegram()` — used by Task 7.

- [ ] **Step 1: Add the type import**

In `apps/web/src/lib/queries.ts`, add `TelegramLinkStatusResponse` to the existing `import type { ... } from "@gembala/shared"` block (alphabetical, so between `SessionResponse` and `TagCreateInput`):

```ts
  SessionResponse,
  TagCreateInput,
  TagResponse,
  TagUpdateInput,
  TelegramLinkStatusResponse,
```

- [ ] **Step 2: Add the read hook**

Add near `useInvites`:

```ts
export function useTelegramLink() {
  return useQuery({
    queryKey: ["telegram-link"],
    queryFn: () => apiFetch<TelegramLinkStatusResponse>("/telegram/link"),
  })
}
```

- [ ] **Step 3: Add the write hook**

Add near `useRevokeInvite`:

```ts
export function useUnlinkTelegram() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiFetch<void>("/telegram/link", { method: "DELETE" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["telegram-link"] }),
  })
}
```

- [ ] **Step 4: Type-check**

Run: `pnpm --filter @gembala/web build`
Expected: exits 0 (this also confirms Task 3's shared build output is picked up correctly).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/queries.ts
git commit -m "feat(web): add useTelegramLink/useUnlinkTelegram query hooks"
```

---

### Task 7: Telegram settings page

**Files:**
- Create: `apps/web/src/pages/telegram.tsx`

**Interfaces:**
- Consumes: `useTelegramLink`, `useUnlinkTelegram` (Task 6); `Card`, `Badge`, `Button` from `@/components/ui/*`; `PageHeader` from `@/components/page-header`.
- Produces: `TelegramPage` component — used by Task 8.

- [ ] **Step 1: Write the page**

Create `apps/web/src/pages/telegram.tsx`:

```tsx
import { CheckCircle2, Send } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { PageHeader } from "@/components/page-header"
import { useTelegramLink, useUnlinkTelegram } from "@/lib/queries"

export function TelegramPage() {
  const { data, isLoading } = useTelegramLink()
  const unlink = useUnlinkTelegram()

  return (
    <div>
      <PageHeader title="Telegram" subtitle="Link your Telegram account to Gembala." />

      <Card className="max-w-lg p-6">
        <div className="flex items-start gap-4">
          <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
            <Send className="size-5" />
          </div>
          <div className="flex-1">
            <h2 className="font-medium">Telegram Bot</h2>
            <p className="text-muted-foreground mt-0.5 text-sm">
              Connect your personal Telegram account.
            </p>
          </div>
        </div>

        <div className="mt-5">
          {isLoading || !data ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : data.linked ? (
            <div>
              <div className="mb-3 flex items-center gap-2">
                <Badge variant="outline" className="border-primary/20 bg-primary/15 text-primary">
                  <CheckCircle2 className="size-3.5" /> Connected
                </Badge>
                {data.telegramUsername && (
                  <span className="text-muted-foreground text-sm">@{data.telegramUsername}</span>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={unlink.isPending}
                onClick={async () => {
                  await unlink.mutateAsync()
                  toast("Telegram unlinked")
                }}
              >
                {unlink.isPending ? "Unlinking…" : "Unlink Telegram"}
              </Button>
            </div>
          ) : (
            <div>
              {!data.botConfigured && (
                <p className="text-muted-foreground mb-3 text-sm">
                  The bot isn't connected yet — check back later.
                </p>
              )}
              <p className="mb-3 text-sm">
                {data.botUsername
                  ? `Message @${data.botUsername} on Telegram with the code below.`
                  : "Send the code below to the bot on Telegram once it's connected."}
              </p>
              <div className="bg-muted/40 rounded-lg border p-4">
                <p className="text-muted-foreground mb-1 text-xs">Your one-time code</p>
                <p className="font-mono text-2xl font-bold tracking-widest">{data.code}</p>
                <p className="text-muted-foreground mt-2 text-xs">
                  Send: /link {data.code} — expires {new Date(data.expiresAt).toLocaleTimeString()}
                </p>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm --filter @gembala/web build`
Expected: exits 0. (This file isn't routed yet, but `tsc -b` compiles the whole `src` tree so unused-but-present files still type-check.)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/telegram.tsx
git commit -m "feat(web): add TelegramPage"
```

---

### Task 8: Route + sidebar entry, end-to-end verification

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/components/app-sidebar.tsx`

**Interfaces:**
- Consumes: `TelegramPage` (Task 7).
- Produces: reachable route `/settings/telegram`, visible in the sidebar for every logged-in user regardless of role.

- [ ] **Step 1: Add the route**

In `apps/web/src/App.tsx`, add the import (alphabetically, after `TagsPage`):

```ts
import { TagsPage } from "@/pages/tags"
import { TelegramPage } from "@/pages/telegram"
import { InvitesPage } from "@/pages/invites"
```

Note: keep existing import order for the others; just insert the `TelegramPage` import line. Then add the route inside the authenticated `<Route>` group, after `/settings/invites`:

```tsx
          <Route path="/settings/invites" element={<InvitesPage />} />
          <Route path="/settings/telegram" element={<TelegramPage />} />
```

- [ ] **Step 2: Add a "Personal" sidebar group visible to everyone**

Replace the full contents of `apps/web/src/components/app-sidebar.tsx` with:

```tsx
import { LayoutDashboard, Users, Sprout, Leaf, Tags, MailPlus, Send } from "lucide-react"
import { NavLink } from "react-router-dom"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useAuth } from "@/lib/auth"
import { MemberAvatar } from "@/components/member-avatar"

type NavItem = { title: string; to: string; icon: typeof LayoutDashboard }

const nav: NavItem[] = [
  { title: "Dashboard", to: "/", icon: LayoutDashboard },
  { title: "Small Groups", to: "/groups", icon: Sprout },
  { title: "Members", to: "/members", icon: Users },
  { title: "Tags", to: "/tags", icon: Tags },
]

const adminNav: NavItem[] = [{ title: "Invites", to: "/settings/invites", icon: MailPlus }]

const personalNav: NavItem[] = [{ title: "Telegram", to: "/settings/telegram", icon: Send }]

function NavItems({ items }: { items: NavItem[] }) {
  return (
    <SidebarMenu>
      {items.map((item) => (
        <SidebarMenuItem key={item.to}>
          <NavLink to={item.to} end={item.to === "/"}>
            {({ isActive }) => (
              <SidebarMenuButton isActive={isActive} tooltip={item.title}>
                <item.icon />
                <span>{item.title}</span>
              </SidebarMenuButton>
            )}
          </NavLink>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  )
}

export function AppSidebar() {
  const { me, isAdmin } = useAuth()
  const manageItems = isAdmin ? [...nav, ...adminNav] : nav

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-lg">
            <Leaf className="size-5" />
          </div>
          <div className="leading-tight">
            <div className="font-heading text-lg font-bold">Gembala</div>
            <div className="text-muted-foreground text-xs">{me?.org.name ?? "Shepherd your people"}</div>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Manage</SidebarGroupLabel>
          <SidebarGroupContent>
            <NavItems items={manageItems} />
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Personal</SidebarGroupLabel>
          <SidebarGroupContent>
            <NavItems items={personalNav} />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        {me && (
          <div className="flex items-center gap-2 rounded-md p-2">
            <MemberAvatar name={me.user.name} />
            <div className="leading-tight">
              <div className="text-sm font-medium">{me.user.name}</div>
              <div className="text-muted-foreground text-xs">{me.roleLabel}</div>
            </div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  )
}
```

- [ ] **Step 3: Type-check**

Run: `pnpm --filter @gembala/web build`
Expected: exits 0.

- [ ] **Step 4: Manual end-to-end verification in the browser**

With Postgres up (`pnpm db:up`), run both dev servers: `pnpm dev:api` and `pnpm dev:web` (separate terminals).

1. Open the web app, log in as any user (admin or non-admin/leader).
2. Confirm the sidebar shows a "Personal" section with a "Telegram" item — for **both** an admin and a non-admin login (this is the bug being fixed: previously nothing was reachable for non-admins).
3. Click it, confirm `/settings/telegram` loads, shows a one-time code, and (since `TELEGRAM_BOT_TOKEN` is unset in dev) shows the "bot isn't connected yet" notice.
4. Using the code shown, repeat the curl simulation from Task 5 Step 4 against `/api/telegram/webhook/<secret>` with `chat.id` set to any number and `text: "/link <code>"`.
5. Refresh `/settings/telegram` in the browser — confirm it now shows "Connected" with the badge and username.
6. Click "Unlink Telegram" — confirm it returns to the code view.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/components/app-sidebar.tsx
git commit -m "feat(web): route and sidebar entry for Telegram settings page"
```

---

## Plan Self-Review

**Spec coverage:** Data model (Task 1), API endpoints incl. webhook + secret guard (Tasks 4-5), env vars incl. the `botUsername`/`botConfigured` fields the spec's own response shape requires (Tasks 2-3), auto-registration on boot (Task 4), web page/hooks/route/sidebar visibility for all users (Tasks 6-8), error handling for expired/unknown/duplicate codes (Task 4), manual verification in place of the spec's "unit tests" section given the repo has no test framework (documented in Global Constraints, exercised in Tasks 5 and 8).

**Placeholder scan:** none — every step has runnable code or an exact command.

**Type consistency:** `TelegramLinkStatusResponse` (Task 3) matches the shape returned by `TelegramService.getStatus` (Task 4) and consumed by `TelegramPage` (Task 7) field-for-field (`linked`, `telegramUsername`, `code`, `expiresAt`, `botConfigured`, `botUsername`). `TelegramUpdate` is defined once in `telegram.service.ts` (Task 4) and imported, not redefined, in `telegram.controller.ts` (Task 5).

**Deviation from spec:** the spec's Web section suggested `pages/settings/telegram.tsx`; corrected to the flat `pages/telegram.tsx` in Task 7 to match this repo's actual existing convention (`pages/invites.tsx` etc. are flat despite their routes being nested under `/settings/...`).
