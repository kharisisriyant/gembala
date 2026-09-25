# Backend schema + repository refactor

Date: 2026-09-25
Scope: `apps/api` (NestJS + Drizzle ORM) only. No changes to `apps/web` or `mcp-server`.

## Goal

Two structural changes to `apps/api/src`:

1. Split the single 495-line `db/schema.ts` (29 tables) into one schema file
   per module, co-located in that module's folder.
2. Split each module's `x.service.ts` (currently business logic + Drizzle
   queries mixed together) into `x.service.ts` (logic, scope/permission
   checks, DTO mapping) and `x.repository.ts` (the only place that imports
   Drizzle and builds queries).

Both changes are structural only — no behavior change, no API contract
change, no migration changes (the generated SQL/migrations stay identical).

## Current state

- `apps/api/src/db/schema.ts` defines all 29 tables for all modules.
- `apps/api/drizzle.config.ts` points `schema` at that single file.
- Every module (`members`, `groups`, `roles`, `auth`, `authz`, `tags`,
  `households`, `rooms`, `events`, `scheduling`, `invites`, `telegram`,
  `dashboard`, `mail`) has a flat `x.service.ts` that mixes:
  - Drizzle `select`/`insert`/`update`/`delete`/joins, including
    cross-module joins (e.g. `members.service.ts` joins `groups`,
    `groupMembers`, `tags`, `memberTags`)
  - `db.transaction()` blocks
  - Business logic: scope/permission checks, DTO shaping, orchestration
- `authz/auth-context.service.ts` and `authz/scope.service.ts` run raw
  Drizzle queries against other modules' tables (`orgMemberships`,
  `membershipRoles`, `rolePermissions`, `tags`, `membershipScopeTags`)
  despite `authz` owning no tables itself.
- Sub-features inside a module folder (`members/member-relationships.service.ts`,
  `groups/attendance.service.ts`) are separate services with their own
  Drizzle queries, not folded into the parent module's service.

## Phase 1 — schema split

### Table → module ownership

| Module | Tables |
|---|---|
| auth | organizations, users, orgMemberships, passwordResetTokens |
| roles | roles, rolePermissions, membershipRoles |
| tags | tags, membershipScopeTags |
| members | members, memberTags, memberRelationships |
| households | households |
| groups | groups, groupMembers, attendanceSessions, sessionAttendance |
| rooms | rooms |
| events | events |
| scheduling | instanceTypes, roleTemplates, scheduleEvents, serviceInstances, roleAssignments |
| invites | invites, inviteScopeTags, inviteRoles |
| telegram | telegramLinkCodes, telegramLinks |

`authz` and `dashboard` own no tables — they stay consumers of other
modules' schema files, same as today.

### File layout

Each owning module gets `x/x.schema.ts` containing its `pgTable` defs,
enums it exclusively owns, and any `relations()` for its own tables.
`db/schema.ts` becomes a barrel:

```ts
export * from "../auth/auth.schema"
export * from "../roles/roles.schema"
export * from "../tags/tags.schema"
// ... one line per module, alphabetical by ownership order above
```

`drizzle.config.ts` is unchanged (`schema: "./src/db/schema.ts"` still
resolves to every table via the barrel's re-exports). Generated migration
SQL must be byte-identical before/after this phase — verified with
`drizzle-kit generate` producing no new migration file.

### Cross-module references

A module's schema file imports another module's schema file directly for
foreign keys, exactly as today's single-file schema.ts does internally
(e.g. `members.schema.ts` imports `tags` from `tags/tags.schema.ts` for
the `memberTags.tagId` FK). No new indirection layer.

Every other file in the codebase that currently does
`import { x } from "../db/schema"` keeps working unchanged (barrel
re-exports everything) — Phase 1 does not require touching consumer
imports, only extracting definitions and re-exporting.

### Execution

One sweep across all 11 owning modules, done together since it's
mechanical (cut/paste table defs + enums, add barrel re-export, run
`drizzle-kit generate` to confirm no schema diff). Suggested order
(smallest table count first, to catch tooling issues early): rooms →
households → tags → telegram → invites → auth → roles → events → groups
→ scheduling → members.

Acceptance: `pnpm build` (or equivalent) passes, `drizzle-kit generate`
produces zero new migrations, existing tests pass unchanged.

## Phase 2 — service/repository split

Done module-by-module, one PR/commit per module, only after Phase 1 is
merged (so each Phase 2 diff is scoped to that module's own files).

### Pattern

- `x.repository.ts`: `@Injectable()` class, `@InjectDb() private readonly db: Db`
  constructor param. Every method is a Drizzle query (select/insert/update/
  delete/join) against this module's own tables, or — when the current
  service does cross-module joins (e.g. members↔groups↔tags) — against
  those tables too, imported from the other module's schema file. Methods
  return raw row shapes (`typeof members.$inferSelect`, join result
  objects), never API response DTOs.
- `x.service.ts`: keeps `@InjectDb()` removed — no more direct Drizzle
  imports. Constructor takes `x.repository.ts` (and any other repos/
  services it already depends on, e.g. `ScopeService`, `TagsService`
  unchanged). All business logic stays: scope checks, permission asserts,
  404 semantics, DTO mapping from repo rows to `MemberResponse` etc.
- **Transactions**: when a service method needs atomicity across multiple
  repo calls (e.g. `members.service.ts#create` inserting into `members`
  then `memberTags`), the service opens the transaction via
  `this.db.transaction(async (tx) => { ... })` and passes `tx` through as
  an optional last argument to each repo method, which defaults to the
  injected `db` when not given:

  ```ts
  // members.repository.ts
  async insert(orgId: string, input: MemberCreateInput, tx: Db = this.db) {
    const [row] = await tx.insert(members).values({...}).returning()
    return row
  }

  // members.service.ts
  async create(auth: AuthContext, input: MemberCreateInput) {
    ...
    const created = await this.db.transaction(async (tx) => {
      const row = await this.membersRepo.insert(auth.orgId, input, tx)
      await this.membersRepo.attachTags(row.id, tagIds, tx)
      return row
    })
    ...
  }
  ```

  This means `x.service.ts` keeps a (minimal) `@InjectDb()` — solely to
  call `.transaction()` — but never builds a query itself. This is the one
  intentional exception to "repository is the only place with Drizzle
  query-building."

- Sub-feature services (`member-relationships.service.ts`,
  `attendance.service.ts`) each get their own sibling repository
  (`member-relationships.repository.ts`, `attendance.repository.ts`)
  rather than merging into the parent module's repository file.
- `authz/auth-context.service.ts` and `authz/scope.service.ts` get an
  `authz.repository.ts` (or two, if that reads cleaner given they query
  different table sets) even though `authz` owns no schema file — same
  split, just no corresponding schema extraction in Phase 1.
- `x.module.ts` adds the repository to `providers` (and does not export it
  unless another module's service legitimately needs to inject it
  directly — prefer exposing through the owning service instead).

### Order

Same module order as Phase 1: rooms → households → tags → telegram →
invites → auth → roles → events → groups → scheduling → members. Each
module: extract repository, update service to depend on it, update
module providers, run build + tests, commit, move to next module.
`authz` is done after its table-owning dependencies (roles, tags) are
converted, since its repository imports their schema files.

### Out of scope

- `dashboard` and `mail` modules: `dashboard.service.ts` aggregates other
  services (not raw Drizzle) and `mail.service.ts` has no DB access —
  neither needs a repository. Confirm during implementation; if either
  does turn out to hold raw queries, give it the same treatment.
- No change to controllers, DTOs (`dto.ts`), module public API, or
  `@gembala/shared` response types.
- No change to `drizzle-kit` migration history.

## Testing

Structural refactor — no new tests required. Existing test suite (if any
covers these modules) must continue passing after each module's Phase 2
commit. If a module has no existing test coverage, that's pre-existing
and out of scope to backfill here.

## Risks

- Cross-module repository imports (a module's repository importing
  another module's schema file to do a join) could create import cycles
  if two modules' repositories both join each other's tables. None of the
  current cross-module joins are mutual (e.g. members→groups/tags is
  one-directional), so this isn't expected to bite, but watch for it
  during Phase 2 and break the cycle by moving the join to whichever
  service already depends on both repos, doing two queries + in-memory
  join instead of one SQL join, if it does occur.
- `authz`'s repository depends on `roles` and `tags` schema files; doing
  `authz` last in Phase 2 (after those modules) avoids half-migrated
  imports.
