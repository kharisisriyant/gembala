# Role-Based Access Control (RBAC) — Design

Status: Approved for planning
Date: 2026-09-24

## Context

Today access control is a hybrid of two mechanisms:

- **Role** — `orgMemberships.role` is a 2-value enum (`admin` | `leader`).
  `RolesGuard` + `@Roles("admin")` gate a handful of write endpoints
  (`tags.controller.ts`, `invites.controller.ts`); everything else is open to
  any authenticated member.
- **Scope** — a tag-based row-level filter (`ScopeService`,
  `membershipScopeTags`) that determines *which* members/groups a `leader`
  can see and write, independent of role.

This is too coarse: there's no way to say "this leader can edit members but
not delete tags" or "this leader can manage small groups but not invite
people." The user wants real RBAC: a `roles` concept where each user/leader
can hold multiple roles, and each role carries its own per-resource CRUD
permissions (e.g. `members[create,read,update,delete]`,
`small_group[create,read,update,delete]`), enforced in both the NestJS API
and the React frontend.

## Goals

- Org admins can create custom roles, name them, and grant each role a set
  of `resource:action` permissions (CRUD × members, groups, households,
  tags, invites).
- A user can hold multiple roles within an org; their effective permissions
  are the union of all assigned roles' permissions.
- Every API endpoint that mutates or reads a gated resource is protected by
  a permission check, not just the two write endpoints gated today.
- The frontend hides/disables actions the current user can't perform, and
  blocks direct navigation to pages they don't have permission for.
- The existing tag-based **scope** system (which rows are visible) is left
  alone — it stays a separate, orthogonal dimension from RBAC (which
  actions are allowed).

## Non-goals

- Replacing or redesigning the scope system.
- Building a full audit log of permission changes.
- Per-object (row-level) permission overrides beyond what scope already
  provides — permissions are resource-type-level (all members), not
  per-record.
- Adding new delete functionality for resources that don't have a delete
  endpoint today (members, groups, households — see "Permission catalog vs.
  wired endpoints" below).

## Addendum (2026-09-25)

Two new feature areas (`rooms`, `events`) landed in the codebase after this
spec was approved. Per the approved "all existing feature areas" scope
decision, they're included as first-class resources everywhere `members`/
`groups`/`households`/`tags`/`invites` are mentioned below: the permission
catalog gains `rooms:*` and `events:*`, `rooms` keeps its current
`@Roles("admin")`-equivalent gate on create/update/delete (→
`rooms:create/update/delete`) with `rooms:read` open the same way
`rooms:read`/list is today, and `events` (currently fully ungated) gets the
same CRUD mapping. The implementation plan carries the concrete endpoint
table.

## Data model

Replace `orgMemberships.role` / `roleLabel` and `invites.roleLabel` with
four new tables in `apps/api/src/db/schema.ts`. The `membershipRole` pgEnum
is removed.

```ts
export const roles = pgTable(
  "roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    // true only for the seeded "Admin" role — see "System admin role" below.
    isSystemAdmin: boolean("is_system_admin").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("roles_org_name_uq").on(t.orgId, t.name),
    index("roles_org_idx").on(t.orgId),
  ],
)

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: uuid("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
    // "resource:action", e.g. "members:create". Validated against the shared
    // ALL_PERMISSIONS list at the application layer, not a DB enum, so adding
    // a new resource/action never requires a migration.
    permission: text("permission").notNull(),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permission] })],
)

export const membershipRoles = pgTable(
  "membership_roles",
  {
    membershipId: uuid("membership_id").notNull().references(() => orgMemberships.id, { onDelete: "cascade" }),
    roleId: uuid("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.membershipId, t.roleId] })],
)

export const inviteRoles = pgTable(
  "invite_roles",
  {
    inviteId: uuid("invite_id").notNull().references(() => invites.id, { onDelete: "cascade" }),
    roleId: uuid("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.inviteId, t.roleId] })],
)
```

`orgMemberships` keeps `id`, `orgId`, `userId`, `createdAt` — `role` and
`roleLabel` columns are dropped. `invites` drops `roleLabel`; the roles it
grants on acceptance live in `inviteRoles`.

Roles are **org-scoped** (each org manages its own role list), matching how
`tags` already work.

### Permission catalog

Defined once in `packages/shared/src/schemas.ts` so both sides stay in sync:

```ts
export const permissionResourceSchema = z.enum(["members", "groups", "households", "tags", "invites"])
export const permissionActionSchema = z.enum(["create", "read", "update", "delete"])
export const ALL_PERMISSIONS = /* cartesian product, "resource:action" strings */
```

`dashboard` and `telegram` stay ungated (dashboard is a read-only overview
available to anyone signed in today; telegram linking is a personal,
self-service action tied to the caller's own account, not an org resource).

**Permission catalog vs. wired endpoints:** the catalog includes `delete`
for every resource for uniformity in the roles UI, but `members`, `groups`,
and `households` have no delete endpoint in the API today. Those permission
keys will exist and be assignable, but nothing checks them yet — adding
real delete endpoints is out of scope for this change.

### System admin role

Regular permissions are assignable by org admins through the roles UI. Role
management itself is **not** a regular permission — if "can edit roles" were
just another grantable permission, a role holding it could grant itself
anything, which is a privilege-escalation hole. Instead:

- Every org gets exactly one protected role, seeded at org creation, named
  "Admin" with `isSystemAdmin: true`. It implicitly has every permission
  (checked by the `isSystemAdmin` flag, not by enumerating `role_permissions`
  rows for it) and cannot be edited, renamed, or deleted.
- Managing roles (create/edit/delete a role, change a member's role
  assignments) requires `isSystemAdmin`, enforced by a dedicated guard —
  never a `resource:action` permission.
- When **inviting** someone or editing a member's roles, a non-system-admin
  actor (e.g. someone with `invites:create`) can only assign roles that are
  themselves not `isSystemAdmin` — this prevents a regular inviter from
  minting a new Admin. System admins are unrestricted.

A second convenience role, "Leader" (not system-protected, editable/
deletable), is seeded with a sensible starting permission set — see
Migration below.

## Backend

### AuthContext

```ts
export type AuthContext = {
  userId: string; userName: string; userEmail: string
  orgId: string; orgName: string; membershipId: string
  roles: { id: string; name: string }[]
  isSystemAdmin: boolean
  permissions: Set<string>  // union of assigned roles' permissions; irrelevant when isSystemAdmin
  scopeTagNames: string[] | null  // unchanged — null now means isSystemAdmin instead of role === "admin"
}
```

`AuthContextService.load()` joins `users` → `orgMemberships` →
`organizations` as today, then loads `membershipRoles` → `roles` (+ their
`rolePermissions`) for that membership, still re-read fresh from the DB on
every request (no caching in the JWT). `scopeTagNames` stays `null` exactly
when `isSystemAdmin` is true, otherwise computed from
`membershipScopeTags` exactly as today. `ScopeService` is untouched.

### Guard & decorators

`apps/api/src/authz/decorators.ts` replaces `@Roles(...)` with:

```ts
export const RequirePermission = (resource: PermissionResource, action: PermissionAction) =>
  SetMetadata(PERMISSION_KEY, permissionKey(resource, action))
export const RequireSystemAdmin = () => SetMetadata(SYSTEM_ADMIN_KEY, true)
```

`RolesGuard` becomes `PermissionsGuard` (`apps/api/src/authz/permissions.guard.ts`):
checks `SYSTEM_ADMIN_KEY` first (requires `auth.isSystemAdmin`), else
`PERMISSION_KEY` (requires `auth.isSystemAdmin || auth.permissions.has(key)`),
else allows (no metadata = no gate, same fallback behavior as today).
Registered in `app.module.ts`'s `APP_GUARD` list in place of `RolesGuard`.

### Endpoint → permission mapping

| Controller | Handler | Permission |
|---|---|---|
| members | `GET /`, `GET /:id`, `GET /:id/relationships` | `members:read` |
| members | `POST /`, `POST /import` | `members:create` |
| members | `PATCH /:id` | `members:update` |
| members | `POST /:id/relationships`, `DELETE /:id/relationships/...` | `members:update` |
| groups | `GET /`, `GET /:id`, `GET /attendance-heatmap` | `groups:read` |
| groups | `POST /` | `groups:create` |
| groups | `PATCH /:id`, `POST /:id/sessions` | `groups:update` |
| households | `GET /`, `GET /count`, `GET /:id` | `households:read` |
| households | `POST /` | `households:create` |
| households | `PATCH /:id`, `POST/DELETE /:id/members/:memberId` | `households:update` |
| tags | `GET /` | `tags:read` |
| tags | `POST /` | `tags:create` |
| tags | `PATCH /:name` | `tags:update` |
| tags | `DELETE /:name` | `tags:delete` |
| invites | `GET /` | `invites:read` |
| invites | `POST /` | `invites:create` |
| invites | `DELETE /:id` | `invites:delete` |
| invites | `GET /token/:token` | `@Public()` (unchanged) |

New `apps/api/src/roles/` module (`RolesService` + two controllers, both
entirely `@RequireSystemAdmin()`):

- `RolesController` (`/roles`): list/create/update/delete org roles.
  Update/delete reject `isSystemAdmin` roles.
- `TeamController` (`/team`): list org memberships (user, email, current
  roles, scope) and replace a membership's role set.

Plus one endpoint outside the system-admin gate, used by the invite-creation
UI: `GET /roles/assignable`, gated by `invites:create`, returning roles the
caller may grant (all roles if `isSystemAdmin`, non-`isSystemAdmin` roles
otherwise). `InvitesService.create` enforces the same filter server-side
regardless of what the client sends.

### Auth service changes

- `register()`: after creating the org + admin membership, insert the
  seeded "Admin" (`isSystemAdmin: true`) and "Leader" roles for the org,
  and a `membershipRoles` row linking the creating membership to "Admin".
- `acceptInvite()`: after creating the membership, copy `inviteRoles` →
  `membershipRoles` (same pattern already used for scope tags).
- `meFromContext()` / `loadMe()`: build `roles`, `isSystemAdmin`,
  `permissions` from the loaded role rows instead of the old `role`/
  `roleLabel` columns.

### Shared schema changes (`packages/shared/src/schemas.ts`)

- Add `permissionResourceSchema`, `permissionActionSchema`, `ALL_PERMISSIONS`,
  `roleCreateSchema`/`roleUpdateSchema`/`RoleResponse`.
- `MeResponse`: replace `role`/`roleLabel` with
  `roles: { id: string; name: string }[]`, `isSystemAdmin: boolean`,
  `permissions: string[]`.
- `inviteCreateSchema`: replace `roleLabel` with `roleIds: z.array(z.string().uuid()).min(1)`.
- `InviteResponse` / `InvitePreviewResponse`: replace `roleLabel` with
  `roles: { id: string; name: string }[]`.
- Remove `membershipRoleSchema`/`MembershipRole` (no longer referenced once
  `orgMemberships.role` is gone).

## Migration

One drizzle migration (`apps/api/drizzle/0004_*.sql`) combining DDL and a
data migration, following the pattern of `0003_clammy_doctor_octopus.sql`:

1. Create `roles`, `role_permissions`, `membership_roles`, `invite_roles`.
2. Data migration (raw SQL, run before dropping old columns):
   - For every `organizations` row, insert an `isSystemAdmin` "Admin" role
     and a "Leader" role (seeded with `members:read/create/update`,
     `groups:read/create/update`, `households:read`, `tags:read` —
     preserving today's leader capabilities, since leaders currently have
     unrestricted read/write on members and groups gated only by scope).
   - Insert `role_permissions` rows for each org's new "Leader" role from
     that baseline set.
   - For every `org_memberships` row with `role = 'admin'`, insert a
     `membership_roles` row to that org's "Admin" role.
   - For every `org_memberships` row with `role = 'leader'`, insert a
     `membership_roles` row to that org's "Leader" role.
3. Drop `org_memberships.role`, `org_memberships.role_label`,
   `invites.role_label`, and the `membership_role` enum type.

This ensures no existing user loses access when the migration runs.

## Frontend

`apps/web/src/lib/auth.tsx`:
- `AuthContextValue` gains `isSystemAdmin: boolean`, `permissions: Set<string>`,
  `hasPermission(resource, action): boolean`. `isAdmin` is removed in favor
  of `isSystemAdmin` (its one existing meaning — "can do anything" — carries
  over exactly).
- New `RequirePermission({ resource, action, children })` and
  `RequireSystemAdmin({ children })` wrapper components (siblings of
  `RequireAuth`), rendering a simple "not authorized" message when the
  check fails, for direct-navigation protection.

`apps/web/src/App.tsx`: wrap `/settings/invites` in
`RequirePermission(invites, read)`, add `/settings/roles` and
`/settings/team` wrapped in `RequireSystemAdmin`.

`apps/web/src/components/app-sidebar.tsx`: replace the `isAdmin`-gated
`adminNav` with per-item `hasPermission`/`isSystemAdmin` checks; add "Roles"
and "Team" nav items under `isSystemAdmin`.

`apps/web/src/pages/tags.tsx`: replace `isAdmin` prop-threading with
`hasPermission("tags", "create"|"update"|"delete")` at each call site.

New pages, following existing list-page conventions
(`page-header.tsx`, shadcn `Table`/`Dialog`/`Sheet`):
- `apps/web/src/pages/roles.tsx` — role list, create/edit dialog with a
  permission matrix (resource rows × action columns as checkboxes), delete
  (disabled for the Admin system role).
- `apps/web/src/pages/team.tsx` — org membership list (name, email, role
  chips, scope), edit-roles dialog per member (checkboxes from
  `/roles`).

`apps/web/src/pages/invites.tsx` / its create dialog: replace the
`roleLabel` free-text field with a multi-select sourced from
`GET /roles/assignable`.

`apps/web/src/lib/queries.ts`: add `useRoles`, `useAssignableRoles`,
`useCreateRole`, `useUpdateRole`, `useDeleteRole`, `useTeam`,
`useUpdateMembershipRoles` hooks, following the existing pattern (mutation
hooks invalidate the relevant query keys on success).

No households page exists on the frontend today — `households:*`
permissions are defined and enforced on the API but there's nothing to gate
in the UI yet.

## Testing / verification

- `pnpm --filter @gembala/api test` (or equivalent) after the migration:
  confirm existing members/groups/tags/invites e2e or unit tests still pass
  under the new guard.
- Manually run the migration against a dev DB seeded from `register()`
  before/after the change; confirm an existing admin and an existing leader
  both retain their current effective access.
- Log in as a non-system-admin user holding a custom role with only
  `members:read` — confirm list/detail work, create/update/delete (where
  wired) are blocked both by a 403 from the API and by hidden/disabled
  buttons in the UI, and direct navigation to `/settings/roles` and
  `/settings/team` is blocked.
- Confirm a non-system-admin with `invites:create` cannot select the
  system Admin role when creating an invite (not offered by
  `/roles/assignable`, and rejected server-side if forced).
