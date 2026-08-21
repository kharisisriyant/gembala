# Telegram Bot Account Linking — Design

Status: Approved for planning
Date: 2026-08-21

## Context

An earlier, now-unused Next.js prototype (`src/app/api/telegram/...`) implemented
Telegram account linking, but the app actually running today is the
`apps/web` (React Router SPA) + `apps/api` (NestJS) monorepo, which has no
Telegram integration at all — no DB tables, no bot module, no UI entry point.

This spec ports the account-linking flow (not attendance-via-chat or member
queries — those are out of scope) into the current architecture, following
the patterns already established by the Invites feature (`apps/api/src/invites/*`,
`apps/web/src/pages/invites.tsx`).

## Goals

- Any logged-in user can link their personal Telegram account to their
  Gembala user account, from a page reachable in the actual running app.
- Linking works by the user messaging a bot with a one-time code generated
  in the app.
- The app runs correctly whether or not a real Telegram bot token has been
  configured yet (no token → feature is inert, rest of the app unaffected).

## Non-goals

- Recording attendance or querying member data via chat commands (the old
  prototype's UI copy mentioned this; it was never implemented and is not
  part of this spec).
- Signature verification of Telegram's webhook payload beyond a secret path
  segment (Telegram's IP-allowlist/secret-header verification can be added
  later once a real bot token exists to test against).

## Data model

Two new tables in `apps/api/src/db/schema.ts`, following the existing
`invites` / `passwordResetTokens` conventions (uuid PK, FK to `users` with
cascade delete):

```ts
export const telegramLinkCodes = pgTable("telegram_link_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  code: text("code").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const telegramLinks = pgTable("telegram_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  telegramChatId: text("telegram_chat_id").notNull(),
  telegramUsername: text("telegram_username"),
  linkedAt: timestamp("linked_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
}, (t) => [
  uniqueIndex("telegram_links_user_active_uq").on(t.userId).where(sql`revoked_at is null`),
  uniqueIndex("telegram_links_chat_active_uq").on(t.telegramChatId).where(sql`revoked_at is null`),
])
```

Partial unique indexes (active-row-only) allow a user to unlink and relink
without deleting history, while still preventing two active links to the
same user or the same Telegram chat.

## API (`apps/api/src/telegram/`)

New `TelegramModule`, mirroring `InvitesModule`'s controller/service split.

- `GET /telegram/link` (authenticated via `@CurrentAuth()`)
  - If the caller has an active link, return `{ linked: true, telegramUsername }`.
  - Otherwise, reuse an unexpired code if one exists, else generate a new
    6-character uppercase hex code with a 10-minute expiry, and return
    `{ linked: false, code, expiresAt, botConfigured, botUsername }`.
    `botConfigured` reflects whether `TELEGRAM_BOT_TOKEN` is set, so the UI
    can show "bot not connected yet" instead of a dead-end code.

- `DELETE /telegram/link` (authenticated) — sets `revokedAt` on the caller's
  active link. 204 on success, no-op if nothing to revoke.

- `POST /telegram/webhook/:secret` (`@Public()`) — Telegram's push target.
  - 404 immediately if `:secret` doesn't match `TELEGRAM_WEBHOOK_SECRET`
    (this is a deliberately simple guard — no token yet to build/test
    Telegram's real signature scheme against).
  - Parses the incoming `message.text`:
    - `/start` → reply with a short help message.
    - `/link <CODE>` → look up the code; if missing/expired, reply with an
      error; if this chat already has an active link, reply "already
      linked"; otherwise mark the code consumed, create the `telegramLinks`
      row, reply with a confirmation.
    - Anything else → generic "send /link <code> from the Integrations page"
      reply.
  - Always returns 200 to Telegram (per their retry semantics) regardless
    of whether the message was understood.

Replies are sent via a plain `fetch` POST to
`https://api.telegram.org/bot<token>/sendMessage` — no SDK dependency,
matching the codebase's preference for small direct integrations (see
`MailService`/`ConsoleMailService` for the analogous pattern of an
env-gated external side effect).

### Env (`apps/api/src/config/env.ts`)

All optional — the app boots and runs identically with none of these set:

- `TELEGRAM_BOT_TOKEN` — bot API token from BotFather.
- `TELEGRAM_WEBHOOK_SECRET` — random string used as the webhook path segment.
- `TELEGRAM_WEBHOOK_URL` — this API's public base URL, used only to
  self-register the webhook with Telegram on boot.

On startup, if both `TELEGRAM_BOT_TOKEN` and `TELEGRAM_WEBHOOK_URL` are set,
`TelegramModule` calls Telegram's `setWebhook` once with
`${TELEGRAM_WEBHOOK_URL}/api/telegram/webhook/${TELEGRAM_WEBHOOK_SECRET}`.
If either is missing, it logs that the bot is unconfigured and skips
registration — no crash, no retry loop.

## Web (`apps/web`)

- `packages/shared/src/schemas.ts`: add `TelegramLinkStatusResponse` type
  (linked/unlinked variants matching the API response above).
- `apps/web/src/lib/queries.ts`: `useTelegramLink()` (query), `useUnlinkTelegram()`
  (mutation), both following the existing `useInvites`/`useRevokeInvite` shape.
- `apps/web/src/pages/settings/telegram.tsx`: single card, same visual
  language as `invites.tsx` — shows the code + copyable instruction text
  when unlinked, a "Connected" badge + username + unlink button when linked,
  and a muted "bot not connected yet" notice when `botConfigured` is false.
- `apps/web/src/App.tsx`: add route `/settings/telegram` inside the existing
  authenticated `<Layout />` route group.
- `apps/web/src/components/app-sidebar.tsx`: today the sidebar has one
  `Manage` group gated entirely by `isAdmin`. Add a second `SidebarGroup`
  (e.g. "Personal") rendered for every logged-in user, containing the
  Telegram nav item, so non-admin leaders can reach it too.

## Error handling

- Expired or unknown code sent to the bot → clear chat reply, no 500s.
- Double-linking the same Telegram chat to two users → prevented by the
  partial unique index on `telegramChatId`; service catches the constraint
  violation and replies "this Telegram account is already linked to another
  user."
- Webhook secret mismatch → 404, no information leaked about whether a real
  secret exists.
- Missing bot token → `GET /telegram/link` still works (code generation is
  harmless), UI just flags the bot as not connected instead of erroring.

## Testing

- Unit tests on `TelegramService`: code generation/reuse/expiry, link
  creation, revoke + relink, duplicate-chat rejection.
- Webhook handler tested by hand with `curl` payloads shaped like Telegram's
  `Update` object, since no real bot token exists yet to test end-to-end.
- Existing app test suites (if any) re-run to confirm no regression from
  the new module/routes/sidebar group.
