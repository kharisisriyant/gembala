# Gembala

> _Gembala_ (Indonesian: "shepherd") — a tool for church leaders, teachers, and
> coordinators to shepherd their people.

Full-stack pnpm monorepo:

```
apps/web          React 19 + Vite + shadcn/ui frontend (TanStack Query)
apps/api          NestJS + Drizzle + PostgreSQL REST API
packages/shared   zod schemas + tag-tree helpers shared by both
```

## Run

```bash
pnpm install
pnpm db:up          # PostgreSQL 17 via docker compose (host port 5433)
pnpm db:migrate     # apply drizzle migrations
pnpm db:seed        # demo org with members, groups, sessions, logins
pnpm dev            # api on :3000, web on :5173
```

Seeded logins (password `password123`):

| Email | Role | Scope |
|---|---|---|
| `pastor.david@gembala.dev` | Admin | everything |
| `andrew@gembala.dev` | Youth Leader | `#youth` subtree |
| `hana@gembala.dev` | Worship Coordinator | `#worship` subtree |
| `gerald@gembala.dev` | Couples Coordinator | `#married` subtree |

## Features

- **Auth** — email/password register, login, forgot/reset password.
  Registering creates a new **organization** (tenant) with you as admin.
- **Invites** — admins invite leaders by email with a role label + scope tags
  (`/settings/invites`). Dev mailer logs the accept/reset links to the API console.
- **Dashboard** (`/`) — stats, recent group meetings, tag breakdown, latest prayer notes.
- **Small Groups** (`/groups`, `/groups/:id`) — komsel/cell groups with
  **attendance tracking**: per-meeting who-came, topic, and prayer notes.
- **Members** (`/members`) — directory with search, tag filtering, and a detail panel.
- **Tags** (`/tags`) — **structured (nested) tags** with per-tag member counts
  (direct and whole-subtree). Deleting a tag re-parents its children; tags used
  as a group's scope can't be deleted (409). Admin-only writes.

## Tag-based RBAC

Roles are expressed entirely through **tags**. A member carries tags like
`#youth #guitarist #members`. An org member either:

- is an **admin** (`scopeTags: null`) and sees everyone, or
- is a **leader scoped to tags** (e.g. a youth leader scoped to `#youth`) and only
  sees members/groups carrying one of those tags. Leaders get scoped writes:
  they can manage members, groups, and attendance inside their scope; tags and
  invites are admin-only.

**Tags are hierarchical.** Scoping to a parent tag automatically grants its whole
subtree — a youth leader scoped to `#youth` also sees members tagged `#teen` or
`#college`. The forest helpers live in `packages/shared/src/tag-tree.ts` and are
used by **both** the web UI and the API's `ScopeService`, so client and server
agree on subtree semantics. Authorization is enforced server-side on every
request (`apps/api/src/authz/`).

## Structure

```
apps/web/src/
  components/      layout, sidebar, user menu, dialogs, shadcn ui/
  lib/api.ts       fetch wrapper (VITE_API_URL, bearer token, 401 handling)
  lib/auth.tsx     AuthProvider + RequireAuth
  lib/queries.ts   TanStack Query hooks per endpoint
  pages/           dashboard, small-groups, group-detail, members, tags, invites, auth/

apps/api/src/
  auth/            register, login, reset password, accept invite
  authz/           JwtAuthGuard, RolesGuard, ScopeService (tag-subtree RBAC)
  db/              drizzle module, schema, seed
  invites/ members/ groups/ tags/ dashboard/  domain modules
  mail/            MailService abstraction + console stub

packages/shared/src/
  schemas.ts       zod schemas + request/response types
  tag-tree.ts      pure forest helpers (roots, children, descendants, expansion)
```

Environment: copy `apps/api/.env.example` to `apps/api/.env`. The web app reads
`VITE_API_URL` from `apps/web/.env.development`.
