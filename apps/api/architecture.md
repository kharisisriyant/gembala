# apps/api architecture

Conventions for this NestJS + Drizzle backend. See
`docs/superpowers/specs/2026-09-25-backend-schema-repository-refactor-design.md`
for the one-time migration plan that brought existing modules to this
shape; this file is the standing reference for new/changed code.

## Module folder layout

Each feature is a folder under `src/`:

```
members/
  members.module.ts            # DI wiring: controller + service + repository
  members.controller.ts        # HTTP layer: routing, request/response, guards
  members.service.ts           # business logic
  members.service.spec.ts      # unit tests for the service (mocked repository)
  members.repository.ts        # all Drizzle queries for this module
  members.schema.ts            # this module's pgTable defs + enums + relations
  dto.ts                       # request/response DTOs (zod/nestjs-zod), if any
  member-relationships.service.ts      # sub-feature: same pattern, own repo
  member-relationships.service.spec.ts
  member-relationships.repository.ts
```

A sub-feature within a module (e.g. `member-relationships`,
`attendance`) gets its own `service.ts` + `repository.ts` pair rather
than being folded into the parent module's files.

Top-level, alongside `src/`:

```
apps/api/
  src/
  test/
    jest-e2e.json              # e2e Jest config (separate from unit test config)
    setup-test-db.ts           # resets/migrates the test DB, imported by e2e specs
    members.e2e-spec.ts        # HTTP-level tests per module, one file per module
    groups.e2e-spec.ts
    ...
```

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

## Testing

Jest, `@nestjs/testing`, and `supertest`. Unit tests are colocated with
the code they test; e2e tests live in `apps/api/test/`, one file per
module, run against a real Postgres test database (not mocked) so
queries and constraints are actually exercised.

**Unit tests — service layer only.** A service's `.spec.ts` mocks its
repository (plain object of `jest.fn()`s, or `jest.mocked<Repo>`), so the
test exercises business logic — scope/permission checks, DTO mapping,
error cases (404s, validation) — without a database:

```ts
// members.service.spec.ts
const repo = { orgMembersWithTags: jest.fn(), insert: jest.fn(), attachTags: jest.fn() }
const scope = { expandedScope: jest.fn(), memberVisible: jest.fn(), assertCanWriteMemberTags: jest.fn() }

describe("MembersService.list", () => {
  it("filters out-of-scope members", async () => {
    repo.orgMembersWithTags.mockResolvedValue([{ id: "1", tags: ["youth"], ... }])
    scope.expandedScope.mockResolvedValue(someScope)
    scope.memberVisible.mockReturnValue(false)
    const service = new MembersService(repo as any, scope as any, tagsService as any)
    expect(await service.list(auth)).toEqual([])
  })
})
```

Repositories are **not** unit tested in isolation — they're thin query
builders whose only real behavior is the SQL Drizzle generates, which is
covered by e2e tests running against a real database. Don't mock the DB
to unit-test a repository; if a repository method has logic worth
testing on its own, that logic probably belongs in the service instead.

**E2e tests — full HTTP stack.** One `x.e2e-spec.ts` per module, boots
the real Nest app (`Test.createTestingModule({ imports: [AppModule] })`)
against a disposable/reset test database, and drives it through
`supertest` like a real client — including auth (login or a seeded JWT)
and guards:

```ts
// test/members.e2e-spec.ts
describe("MembersController (e2e)", () => {
  let app: INestApplication

  beforeAll(async () => {
    await resetTestDb()
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    await app.init()
  })

  afterAll(() => app.close())

  it("POST /members creates a member visible to the creating org", async () => {
    await request(app.getHttpServer())
      .post("/members")
      .set("Authorization", `Bearer ${testToken}`)
      .send({ name: "Jane", email: "jane@example.com", tags: [] })
      .expect(201)
  })
})
```

Test DB: a separate Postgres database (or schema) from dev, reset via
migration + optional seed before each e2e run — never point e2e tests at
the dev/seed database. `test/setup-test-db.ts` centralizes that
reset/migrate logic so every `*.e2e-spec.ts` calls the same setup.

**Coverage expectation for new/refactored modules:** each module's
Phase 2 PR (service/repository split) adds `x.service.spec.ts` covering
that service's business-logic branches, and `test/x.e2e-spec.ts`
covering its controller's endpoints (happy path + the main error cases:
404/out-of-scope, validation failure, permission denied). Existing
modules without tests don't block the schema-split (Phase 1); test
coverage is added as each module goes through Phase 2.

**Scripts** (add to `apps/api/package.json`):
```json
"test": "jest",
"test:watch": "jest --watch",
"test:cov": "jest --coverage",
"test:e2e": "jest --config ./test/jest-e2e.json"
```

## Adding a new module

1. Create the folder with `x.module.ts`, `x.controller.ts`,
   `x.service.ts`, `x.repository.ts`, and `x.schema.ts` if it owns
   tables.
2. Add `export * from "../x/x.schema"` to `db/schema.ts` if it owns
   tables.
3. Register `x.repository.ts` in `x.module.ts` providers; export it only
   if another module's service legitimately needs to inject it directly
   (prefer going through the owning service instead).
4. Add `x.service.spec.ts` next to the service and `test/x.e2e-spec.ts`
   for its controller (see Testing above).

## Cross-cutting modules

`authz` owns no tables but does run queries against other modules'
tables (`orgMemberships`, `membershipRoles`, `tags`, ...) to resolve
scope/permissions. It follows the same service/repository split
(`authz.repository.ts`) without a corresponding schema file — its
repository imports schema from the modules whose tables it reads.

`dashboard` aggregates other modules' services and `mail` has no DB
access — neither needs a repository unless that changes.
