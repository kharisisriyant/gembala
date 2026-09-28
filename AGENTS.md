# AGENTS.md

Guidance for AI coding agents working in this repo. Human-facing overview is in
[README.md](README.md); product requirements in [PRD.md](PRD.md).

## Layout

pnpm monorepo:

```
apps/api          NestJS + Drizzle + PostgreSQL REST API   (see apps/api/architecture.md)
apps/web          React 19 + Vite + shadcn/ui (TanStack Query)
packages/shared   zod schemas + TS types shared by api and web (built to dist/)
docs/superpowers  design specs and implementation plans
```

`packages/shared` is consumed from its built `dist/`. After changing it, run
`pnpm --filter @gembala/shared build` (or keep `pnpm --filter @gembala/shared dev`
running) before type-checking `apps/api` or `apps/web`.

## Commands

```bash
pnpm install
pnpm db:up                                  # Postgres 17 on host port 5433
pnpm --filter @gembala/api db:migrate       # apply migrations
pnpm --filter @gembala/api db:seed          # demo data
pnpm dev:api                                # API on :3000
pnpm dev:web                                # web on :5173

pnpm --filter @gembala/api test             # unit tests (jest)
cd apps/api && npx tsc --noEmit -p tsconfig.json   # API type-check
```

## Backend rules (apps/api)

Read [apps/api/architecture.md](apps/api/architecture.md) before touching the
API. The short version:

- Module = controller + service + repository (+ schema). Controllers do HTTP
  only, services hold business logic and never build queries, repositories are
  the only place that imports `drizzle-orm` operators.
- Request bodies are `createZodDto(schema)` classes over schemas in
  `packages/shared`; the global `ZodValidationPipe` validates them.
- Service methods get unit tests with a mocked repository.

### Swagger is mandatory

The API serves OpenAPI at `/api/docs` (UI) and `/api/docs-json`. **Every route
must be documented**, and any endpoint you add, remove or change must update its
Swagger decorators in the same change:

- `@ApiTags` on the controller; `@ApiOperation` plus the success response
  (`@ApiOkResponse`/`@ApiCreatedResponse` with a `*ResponseDto`, or
  `@ApiNoContentResponse`) and an `@Api*Response` for each domain error the
  service throws on every method.
- New response type → add the TS type and its zod mirror
  (`satisfies z.ZodType<T>`) in `packages/shared/src/response-schemas.ts`, then a
  `createZodDto` class in `apps/api/src/swagger/response-dtos.ts`.
- Use `@Public()`, `@RequirePermission()`, `@RequireSystemAdmin()` from
  `authz/decorators.ts` for access rules — they also drive the documented
  security requirements. Don't hand-write auth docs.

Details and rationale: "API documentation (Swagger)" in `architecture.md`.
To sanity-check, boot the API and confirm the operation count in
`/api/docs-json` matches the number of route decorators.

## Frontend rules (apps/web)

- All user-facing strings go through react-i18next with both EN and ID
  entries (`apps/web/src/i18n/locales/{en,id}/<namespace>.json`, one namespace
  per page area); reuse `common:` keys for generic actions. No hard-coded copy.
- Types for API payloads come from `@gembala/shared`; don't redeclare them.

## General

- Match surrounding code style (no semicolons, double quotes, 2-space indent).
- Don't commit unless asked; keep changes scoped to the request.
- Don't edit generated output (`dist/`, `drizzle/` snapshots by hand).
