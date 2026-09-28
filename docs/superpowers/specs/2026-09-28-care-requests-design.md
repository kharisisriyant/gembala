# Care & Prayer Requests — Design

Date: 2026-09-28
Status: draft, awaiting review

## Goal

Let leaders record prayer and care requests about members, follow them to
resolution, and keep them private via the existing tag-scope model. A
member-facing submit endpoint is planned for later; the design must not need
a schema change to add it.

## Decisions (agreed)

1. **Submitter:** leader on behalf of a member in v1. Member self-submit later.
2. **Privacy:** a request is visible to a viewer iff the viewer can see the
   request's member (`ScopeService.memberVisible`). No per-request tags, no
   privacy enum. Members with no tags are admin-only, so their requests are too.
3. **Lifecycle:** `open` → `closed` (with optional close note), reopenable.
   No assignee, no threaded updates.
4. **Scope of v1:** API + web UI. Out: Telegram bot tools, dashboard widget,
   member-facing endpoint, attachments, notifications.
5. **Separate from** the attendance `prayerNotes` field (unchanged) and the
   unbuilt PRD `pastoral_notes` (leader-private notes; different privacy rule).

## Data model

New module `apps/api/src/care-requests/` following
[architecture.md](../../../apps/api/architecture.md): controller, service,
repository, schema, colocated service spec.

Table `care_requests`:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | default random |
| `org_id` | uuid FK organizations | cascade |
| `member_id` | uuid FK members | cascade. Person the request is about |
| `type` | enum `care_request_type` | `prayer` \| `care` |
| `body` | text not null | max 2000, enforced by zod |
| `status` | enum `care_request_status` | `open` \| `closed`, default `open` |
| `source` | enum `care_request_source` | `leader` \| `member`; only `leader` written in v1 |
| `submitted_by_user_id` | uuid FK users | nullable; null when `source = member` |
| `closed_at` | timestamptz | nullable |
| `closed_by_user_id` | uuid FK users | nullable |
| `close_note` | text | nullable, max 2000 |
| `created_at`, `updated_at` | timestamptz | default now |

Indexes: `(org_id, status)`, `(member_id)`. Schema re-exported from
`db/schema.ts`. Migration generated with drizzle-kit (not hand-edited).

### Permissions

Add `care_requests` to `permissionResourceSchema` in `packages/shared`
(actions create/read/update/delete via existing `permissionKey`).

- **Admin:** gets it through `ALL_PERMISSIONS` (verify during planning that the
  Admin role is built from that list or bypasses checks).
- **Leader:** add `care_requests:create|read|update` to
  `LEADER_BASELINE_PERMISSIONS` (used by register and seed). `delete` stays
  admin-only.
- **Existing orgs:** the same migration inserts the three leader permissions
  into `role_permissions` for every existing role named `Leader`
  (data step, idempotent via `ON CONFLICT DO NOTHING`). Custom roles are not
  touched; admins grant it in the roles UI.

## API

Controller `care-requests`, `@ApiTags("care-requests")`. Every route carries
`@RequirePermission`, `@ApiOperation`, success response, and an
`@Api*Response` for each error it can throw (AGENTS.md).

| Route | Permission | Behavior |
|---|---|---|
| `GET /care-requests?status&type&memberId` | `care_requests:read` | List, scope-filtered, newest first |
| `GET /care-requests/:id` | `read` | 404 if missing or out of scope |
| `POST /care-requests` `{memberId, type, body}` | `create` | 404 `member not found` if member missing/out of scope. Sets `source=leader`, `submittedByUserId=auth.userId`. 201 |
| `PATCH /care-requests/:id` `{type?, body?}` | `update` | Only while open, else 409 |
| `POST /care-requests/:id/close` `{note?}` | `update` | 409 if already closed |
| `POST /care-requests/:id/reopen` | `update` | 409 if already open. Clears closed fields |
| `DELETE /care-requests/:id` | `delete` | 204. Hard delete |

Out-of-scope reads return 404 (not 403), matching `members.service`, so
existence is not leaked.

### Service

- Depends on `CareRequestsRepository`, `ScopeService`, and `MembersRepository`
  (or a small member lookup on the care-requests repository joining
  `members`/`member_tags`/`tags`, per architecture.md's cross-table join rule).
- Repository returns request rows joined with `memberName` and the member's tag
  names. Service computes `expandedScope` once per call and filters with
  `memberVisible`. Admin scope `null` sees everything.
- Public `create(auth, input)` delegates to a private
  `insert(orgId, input, submitter)` where
  `submitter = {source:"leader", userId} | {source:"member", memberId}`. A future
  member controller reuses `insert` with the second shape. Not exposed in v1.
- Status transitions enforced in the service (`ConflictException`).

### Shared types

`packages/shared`:
- request schemas (`careRequestCreateSchema`, `careRequestUpdateSchema`,
  `careRequestCloseSchema`, list query schema) in `schemas.ts`;
- `CareRequest` response type + zod mirror (`satisfies z.ZodType<T>`) in
  `response-schemas.ts`, with `memberName`;
- `createZodDto` class in `apps/api/src/swagger/response-dtos.ts`.

Rebuild shared (`pnpm --filter @gembala/shared build`) before type-checking.

## Web

- `/care-requests` page: table with status (default `open`) and type filters,
  "New request" dialog (member picker, type, body), row actions close / reopen /
  delete. Close opens a small dialog for the optional note.
- Member detail: "Requests" section listing that member's requests with add
  button, reusing the same dialog.
- Sidebar entry, hidden without `care_requests:read`.
- TanStack Query hooks; payload types from `@gembala/shared`.
- i18n: new namespace `care-requests` with EN and ID files; reuse `common:`
  for generic actions. No hard-coded copy.

## Testing

Unit (service, mocked repository/scope):
- create: out-of-scope or missing member → 404; sets source/submitter.
- get/list: leader does not see out-of-scope or untagged-member requests;
  admin sees all.
- update on closed → 409; close on closed → 409; reopen on open → 409.
- close/reopen set and clear closed fields.

E2E (`apps/api/test/care-requests.e2e-spec.ts`, real Postgres): create → list →
close → reopen → delete; scoped leader cannot see or fetch an out-of-scope
request.

Swagger: boot API, confirm operation count in `/api/docs-json` matches the
7 route decorators.

## Seed & docs

- Seed a few demo requests across tagged members.
- Update README feature list and `apps/api/architecture.md` module list.

## Risks / notes

- Tag-scope changes are retroactive: if a leader loses a tag, they lose
  access to that member's requests (consistent with PRD FR-TAG-02).
- Hard delete loses history; acceptable for v1, revisit if audit logging lands.
- Request body may contain sensitive pastoral information. No extra encryption
  in v1; relies on tag scope and org isolation like other member data.
