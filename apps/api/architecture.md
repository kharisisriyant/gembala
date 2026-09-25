# apps/api architecture

Conventions for this NestJS + Drizzle backend. See
`docs/superpowers/specs/2026-09-25-backend-schema-repository-refactor-design.md`
for the one-time migration plan that brought existing modules to this
shape; this file is the standing reference for new/changed code.

## Module folder layout

Each feature is a folder under `src/`:

```
members/
  members.module.ts        # DI wiring: controller + service + repository
  members.controller.ts    # HTTP layer: routing, request/response, guards
  members.service.ts       # business logic
  members.repository.ts    # all Drizzle queries for this module
  members.schema.ts        # this module's pgTable defs + enums + relations
  dto.ts                   # request/response DTOs (zod/nestjs-zod), if any
  member-relationships.service.ts      # sub-feature: same pattern, own repo
  member-relationships.repository.ts
```

A sub-feature within a module (e.g. `member-relationships`,
`attendance`) gets its own `service.ts` + `repository.ts` pair rather
than being folded into the parent module's files.

## Layer responsibilities

**Controller** — HTTP concerns only: route definitions, param/body
parsing via DTOs, guards/decorators. No business logic, no DB access.

**Service** — business logic: scope and permission checks, validation
beyond DTO shape, orchestration across repositories/other services,
mapping repository rows to response DTOs, opening transactions. A
service never imports from `drizzle-orm` or builds a query — the one
exception is calling `this.db.transaction(...)` to coordinate multiple
repository calls atomically (see below). Constructor-injects the
repositories and services it needs.

**Repository** — the only place that imports `drizzle-orm` operators
(`eq`, `and`, `inArray`, ...) and this module's (or another module's)
schema tables to build queries. One method per query shape the service
layer needs — not a generic CRUD wrapper. Methods return raw row shapes
(`typeof members.$inferSelect` or join-result objects), never API
response DTOs. A repository may query another module's tables directly
(e.g. `members.repository.ts` joining `groups`/`tags` for a read) — that
mirrors real query needs and avoids N+1s from staying strictly
per-module.

**Schema** — `pgTable` definitions, enums, and `relations()` for the
tables this module owns. Imported by this module's repository, and by
any other module's repository/schema that needs the table for a
join/FK. `db/schema.ts` is a barrel re-exporting every module's schema
file — that's what `drizzle.config.ts` points at, and it's how code that
wants "any table" (seed scripts, etc.) still does
`import { x } from "../db/schema"`.

## Transactions across repositories

When a service method must do multiple writes atomically, the **service**
opens the transaction and passes the transaction handle through to each
repository call as an optional trailing argument, defaulting to the
injected `db`:

```ts
// members.repository.ts
async insert(orgId: string, input: MemberCreateInput, tx: Db = this.db) {
  const [row] = await tx.insert(members).values({ orgId, ...input }).returning()
  return row
}

async attachTags(memberId: string, tagIds: string[], tx: Db = this.db) {
  await tx.insert(memberTags).values(tagIds.map((tagId) => ({ memberId, tagId })))
}
```

```ts
// members.service.ts
async create(auth: AuthContext, input: MemberCreateInput) {
  const tagIds = await this.tagsService.resolveTagIds(auth.orgId, input.tags)
  const row = await this.db.transaction(async (tx) => {
    const created = await this.membersRepo.insert(auth.orgId, input, tx)
    await this.membersRepo.attachTags(created.id, tagIds, tx)
    return created
  })
  return this.toResponse(row, input.tags)
}
```

The service holds `@InjectDb()` solely to call `.transaction()` — it
never builds a query itself.

## Adding a new module

1. Create the folder with `x.module.ts`, `x.controller.ts`,
   `x.service.ts`, `x.repository.ts`, and `x.schema.ts` if it owns
   tables.
2. Add `export * from "../x/x.schema"` to `db/schema.ts` if it owns
   tables.
3. Register `x.repository.ts` in `x.module.ts` providers; export it only
   if another module's service legitimately needs to inject it directly
   (prefer going through the owning service instead).

## Cross-cutting modules

`authz` owns no tables but does run queries against other modules'
tables (`orgMemberships`, `membershipRoles`, `tags`, ...) to resolve
scope/permissions. It follows the same service/repository split
(`authz.repository.ts`) without a corresponding schema file — its
repository imports schema from the modules whose tables it reads.

`dashboard` aggregates other modules' services and `mail` has no DB
access — neither needs a repository unless that changes.
