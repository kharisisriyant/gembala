# Care Request Ownership & Due Date — Design

Date: 2026-11-12
Status: implemented
Prerequisite for: [weekly leader digest](2026-11-12-weekly-leader-digest-design.md)

## Goal

Give every care/prayer request an **owner** (who follows up) and a **due date**
(when it counts as overdue). Without both, "needs follow-up" is undefined and a
reminder would go to every leader who can see the member.

## Decisions (agreed)

1. **Owner = a user** (`assigned_to_user_id`), defaulting to the creator. Not a
   member, not a role.
2. **Due date default = created date + 7 days**, applied by the service on
   create. Stored as a plain value, so a leader can change or clear it.
3. **Supersedes** decision 3 of the [care-requests design](2026-09-28-care-requests-design.md)
   ("No assignee"). Threaded updates stay out.
4. Out of scope: notifications (see digest spec), assignee-change history,
   reassigning on leader offboarding (P0 item, separate spec), member self-submit.

## Data model

Add to `care_requests` (`apps/api/src/care-requests/care-requests.schema.ts`):

| Column | Type | Notes |
|---|---|---|
| `assigned_to_user_id` | uuid FK users | nullable, `on delete set null` |
| `due_at` | date | nullable. A calendar date, not an instant: "due Friday" has no time zone problem |

Index: `(assigned_to_user_id, status)` for the per-user digest query.

`NULL` owner means unassigned (member self-submit later, or the assignee's
account was deleted). Unassigned open requests surface in the admin summary
only.

### Migration

One migration generated with drizzle-kit, plus a data step (same pattern as the
care-requests migration):

- `assigned_to_user_id = submitted_by_user_id` for existing rows.
- `due_at = current_date + 7` for **open** rows; `NULL` for closed rows.
  Backfilling from `created_at` would mark every old request overdue and flood
  the first digest.

## API

Changes to existing `care-requests` routes. One new read route, `GET /care-requests/assignees?memberId=`, feeds the assignee picker (the team list is admin-only).

| Route | Change |
|---|---|
| `POST /care-requests` | Body gains optional `assignedToUserId`, `dueAt` (`YYYY-MM-DD`). Service defaults: assignee = `auth.userId`, `dueAt` = today + 7 |
| `PATCH /care-requests/:id` | Body gains optional `assignedToUserId` (nullable), `dueAt` (nullable). Still only while open (409 otherwise) |
| list/get responses | `CareRequest` gains `assignedToUserId`, `assignedToName`, `dueAt`, and `overdue` (derived: open and `dueAt < today`) |
| `GET /care-requests` | New query filters `assignedToUserId` (accepts `me`) and `overdue=true` |

### Validation

- **Assignee must be able to see the member.** An assignee who is out of scope
  of the member would receive items they cannot open. Service checks the
  assignee's expanded scope against the member's tags and returns 422
  `assignee cannot see this member`. Admin assignees always pass. Planning step:
  confirm `ScopeService` can compute scope for a user other than the caller
  (it takes an `AuthContext` today; `AuthContextService` can build one).
- Assignee must belong to the caller's org (404 `user not found` otherwise).
- `dueAt` may be in the past on create/update (allowed; shows overdue).
- Same permissions as today: `care_requests:create|update`. No new permission.

### Service

- `insert(orgId, input, submitter)` (existing private method) applies the
  defaults, so a future member self-submit gets `assignedToUserId = null` and
  `dueAt = today + 7` without a schema change.
- "Today" is the **Asia/Jakarta calendar date**, computed in one helper shared
  with the digest (single fixed zone for v1, no org timezone column yet).
- Reopen keeps the old `dueAt`. If that date has passed, it reappears as
  overdue immediately; this is intended.

### Shared types

`packages/shared`: extend create/update/list-query schemas and the
`CareRequest` response type + zod mirror; update the `CareRequestResponseDto`
in `swagger/response-dtos.ts`. Add `@ApiUnprocessableEntityResponse` on the
create and update routes (AGENTS.md Swagger rule).

## Web

- Care request dialog: **Assignee** select (org users who can see the member;
  default me) and **Due date** picker (default +7 days).
- `/care-requests` table: columns Assignee and Due; red "Overdue" badge; filters
  "Assigned to me" and "Overdue".
- Member detail "Requests" section shows assignee and due date.
- i18n: new keys in `care-requests` namespace, EN and ID. No hard-coded copy.

## Testing

Unit (service, mocked repository/scope):

- create defaults assignee to caller and `dueAt` to today + 7.
- explicit assignee/due date are honored; assignee out of scope → 422; assignee
  from another org → 404.
- update can reassign and clear `dueAt`; update on closed → 409 (unchanged).
- `overdue` is true only for open requests past due.

Swagger: operation count in `/api/docs-json` unchanged (no new routes); new
response fields visible.

## Seed & docs

- Seed: assign demo requests to different leaders, one overdue.
- Update README care-requests bullet and `apps/api/architecture.md`.

## Risks / notes

- Backfill sets every open request due in 7 days, so the first overdue items
  appear one week after deploy. Intended.
- Assigning to someone loses nothing if they later lose scope: the request stays
  open and unassigned-equivalent in the admin summary, because the digest
  re-checks visibility (see digest spec).
