# Weekly Leader Digest — Design

Date: 2026-11-12
Status: implemented
Depends on: [care request ownership](2026-11-12-care-request-ownership-design.md)

## Goal

Every Monday morning, tell each leader what needs their attention this week, so
pastoral care does not depend on someone remembering to open the app. One
message per leader per week, delivered by Telegram when linked, otherwise email.

## Decisions (agreed)

1. **Weekly, not daily.** Monday 07:00 Asia/Jakarta, fixed for v1 (no org
   timezone setting yet).
2. **Telegram first, email as fallback.** No WhatsApp.
3. **One shared attention-items service** feeds the dashboard, the digest and,
   later, a Telegram query tool, so the lists cannot drift apart.
4. **Skip the send when there is nothing to do.** No "all clear" message.
5. **Admins get a summary**, not the personal lists (they see everyone, so the
   lists would be unreadable): counts per leader plus the longest-overdue items.
6. **No pastoral detail in the message.** Member name, request type and age
   only. Request text and notes stay behind the login.
7. In-app notification bell, per-event alerts, snooze, escalation: out of scope.

## What the repo already has (verified)

- **Absence logic exists, inline in the dashboard.** `DashboardService.summary`
  computes `attendanceAlerts`: a member is flagged when absent from all of the
  last 3 sessions of a visible group. `session_attendance` stores only present
  rows, so absence = group member not in `presentIds`. Hard-coded 3, capped at 6.
- **Birthdays**: `daysUntilBirthday` is a private function in the dashboard
  service, using the server's local date.
- **Journey pipeline**: `JourneyService.pipeline(auth, query)` returns
  scope-filtered rows per configured stage (`reminderDays`, rule
  `newcomer_followup`, `course_completed`, `leadership_ready`).
- **Telegram outbound**: `TelegramService.reply` calls `sendMessage` but is
  private; `telegram_links` holds the chat id and `revokedAt`.
- **Mail**: `MailService` has `sendPasswordReset` and `sendInvite` only.
- **No scheduler** (`@nestjs/schedule` not installed).
- **No link between a user and a member row.** `org_memberships` has no
  `member_id`, and role assignments point at members. See "Out of scope".

## Content

Header: week range and counts. Sections in priority order; 1–3 need action,
4–5 are information. Each section caps at 5 lines then `+N more` linking to the
filtered list in the app.

| # | Section | Rule | Source |
|---|---|---|---|
| 1 | Care and prayer | Open requests where `assigned_to_user_id` = recipient. Overdue first, then oldest. Line: name, type, days open, overdue days | `care_requests` |
| 2 | Absent | Member in a visible group absent from the last `ABSENCE_THRESHOLD` sessions. Line: name, group, sessions missed, last attended date | attendance |
| 3 | Newcomers | Pipeline rows for stages with rule `newcomer_followup` | `JourneyService.pipeline` |
| 4 | Ready for next step | Pipeline rows for other stages. Counts per stage name plus link, no names | `JourneyService.pipeline` |
| 5 | Birthdays | Birthday in the 7 days from Monday | members |

Rules:

- **One person, one line** across the action sections (1–3): a member appearing in
  several is shown once under the highest-priority section, annotated ("also
  absent, missed 3"). FYI lines (birthdays, next steps) are not deduplicated.
- **Visibility.** Everything is computed through the recipient's scope. An
  assigned care request whose member the recipient can no longer see is dropped
  from the personal digest and counted in the admin summary.
- **Dormant groups** (latest session older than 60 days) produce no absence
  items. Groups with fewer than `ABSENCE_THRESHOLD` sessions produce none.
- **Language** per recipient: `en` or `id`.

Care requests have no title field, so a line shows the type ("Prayer"/"Care"),
not a topic.

### Example (Telegram, plain text)

```
Good morning Andrew. Week of 16–22 Nov: 5 need you.

CARE (2)
• Budi S. — care request · open 12 days · overdue 4
• Sari W. — prayer request · open 3 days

ABSENT (2)
• Dewi · Youth Komsel · missed 3 · last seen 25 Oct
• Andi · Youth Komsel · missed 2 · last seen 1 Nov

NEWCOMERS (1)
• Rina T. · first visit 20 days ago

FYI
Birthdays: Hana (Wed), Gerald (Sat)
Ready for next step: Baptism class 2, Leader candidates 1

Open gembala: https://…/care-requests
Mute this digest: https://…/profile
```

### Admin summary

Sent instead of the personal digest to users with `isSystemAdmin`:

- Counts per leader: open, overdue care requests.
- Unassigned open requests, and requests assigned to someone who can no longer
  see the member.
- The 5 longest-overdue requests org-wide (name, type, owner, days overdue).
- Org-wide counts for absent members, newcomers and birthdays, with links.
- Plus the admin's own assigned care requests (section 1 format), since an admin
  may also be a leader.

## Architecture

New module `apps/api/src/digest/` per
[architecture.md](../../../apps/api/architecture.md): controller, service,
repository, schema; plus a small `attention/` module.

### Attention service (`apps/api/src/attention/`)

`AttentionService.forUser(auth, asOf)` returns typed items:

```
{ care: [...], absent: [...], newcomers: [...], nextStep: [{stage, count}], birthdays: [...] }
```

- Extracts the absence and birthday logic out of `DashboardService` and reuses
  `JourneyService.pipeline`; care items come from `CareRequestsService`.
- Single constant `ABSENCE_THRESHOLD`. **Behavior change:** the dashboard
  currently uses 3; the PRD default is 2. Proposal: use 2 everywhere, update the
  dashboard test. If you prefer to keep 3 on the dashboard, say so in review.
- `DashboardService` calls the same pure rules (`absenceItems`, `birthdaysWithin`)
  from `attention/attention.ts`, keeping its response shape (its own `slice(0, 6)`
  caps stay in the dashboard). It does not call `AttentionService`, which needs a
  per-user care/journey fan-out the dashboard doesn't want.
- Takes `asOf` as a parameter; no `new Date()` inside. `daysUntilBirthday` moves
  to a shared pure helper and takes the Jakarta date.

### Digest service

1. Select recipients: users with an active org membership
   (`authStatus = active`), `digest_preferences.enabled` not false.
2. For each: build the `AuthContext` (via `AuthContextService`), call
   `AttentionService.forUser`; admin → summary builder instead.
3. If all personal sections are empty → skip, write no log row.
4. Render (pure function: items + locale → `{subject, text, html}`).
5. Deliver, then record.

### Scheduling and idempotency

- Install `@nestjs/schedule`. `@Cron("0 7 * * 1", { timeZone: "Asia/Jakarta" })`
  plus a retry pass at 09:00 that sends only to users with no `sent` row for the
  week.
- Table `digest_log`: `user_id`, `week_start` (date, the Monday), `channel`
  (`telegram`|`email`), `status` (`sent`|`failed`), `error`, `sent_at`;
  unique `(user_id, week_start)`.
- Delivery claims the row first (insert, conflict → skip), then sends, then
  marks `sent` or `failed`. A restart or a second API instance cannot send
  twice. The 09:00 pass retries `failed` rows once.
- One user failing never stops the loop; errors are logged with the user id,
  not the message body.

### Delivery

- Telegram: add a public `TelegramService.send(chatId, text)` (reuse the
  existing `fetch`). Plain text, no Markdown parse mode (member names break it).
  On `403` (bot blocked) or any error, fall back to email and log it.
- Email: add `MailService.sendWeeklyDigest(to, {subject, text, html})`; Resend
  implementation, console implementation for dev.
- Links use the same base-URL config the invite and reset emails use. Verify the
  env name in planning.

## Data model

Migration generated with drizzle-kit:

- `digest_preferences`: `user_id` PK FK users (cascade), `enabled` boolean
  default true, `locale` text (`en`|`id`) default `id`. Row created lazily; no
  row means defaults.
- `digest_log` as above, FK users cascade.

## API

| Route | Auth | Behavior |
|---|---|---|
| `GET /digest/preferences` | authenticated | Own preferences (defaults when no row) |
| `PUT /digest/preferences` `{enabled, locale}` | authenticated | Upsert own row |
| `GET /digest/preview` | authenticated | The digest as it would be sent this week for the caller: `{kind, empty, subject, text}`. Read-only, sends nothing. Used by the profile page and for manual testing |

All three documented per the Swagger rule (new response types in
`response-schemas.ts` and `response-dtos.ts`). They act only on the caller's own
data, so no `@RequirePermission`; confirm the project's convention for
"any authenticated user" routes during planning.

## Web

- `/profile`: "Weekly digest" card with an on/off switch, language select, and a
  "Preview this week's digest" dialog.
- Telegram page: one line noting the digest goes there when linked.
- i18n: `digest.*` keys in the `profile` namespace (EN, ID). Message text itself is rendered
  server-side from a small locale table kept in the digest module.

## Testing

Unit, mocked collaborators:

- `AttentionService`: absence threshold and dormant-group rules; birthday window
  across a year boundary; dedupe keeps the highest-priority section; hidden
  member excluded (**scope-leak test**: a leader scoped to `#youth` gets no item
  for a member tagged only `#worship`).
- Digest service: empty → no send and no log row; admin gets summary; Telegram
  failure falls back to email; existing `sent` row → skipped; failed row retried
  once.
- Renderer: caps at 5 with `+N more`; message under 4096 characters with
  maximum items; EN and ID; contains no request body text.
- Dashboard spec updated for the shared service and threshold.

Integration with a real database is covered by the P0 authorization-tests item,
not here (there is no `apps/api/test` e2e folder yet).

## Seed & docs

- Seed: digest preference rows are lazy; seed gives leaders overdue and absent
  data so the preview shows content.
- README features list, `apps/api/architecture.md` module list, `.env.example`
  if a new variable is needed.

## Out of scope / follow-ups

- **"You're serving" section.** Role assignments reference members, and no
  user-to-member link exists, so the recipient's own assignments cannot be
  found. It needs that link first.
- In-app notification bell, WhatsApp, snooze, escalation, configurable send
  time, organization timezone.
- Telegram bot tool `get_followups` on top of `AttentionService` (cheap next step).

## Risks / notes

- A leader scoped to a broad tag sees many groups; the 5-line caps and links
  keep the message short, but "who is a group's leader" is not modeled, so
  absence items follow scope, not leadership.
- Chat and email are less private than the app; hence names only, no content.
- Resend sending-domain reputation affects the email fallback; Telegram is the
  main path.
- Absence rule is based on session counts, so a group that skips recording
  sessions will show no alerts (silent failure). Acceptable for v1.
