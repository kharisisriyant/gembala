# RBAC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 2-value `admin`/`leader` role enum with a multi-role,
per-resource CRUD permission system, enforced in both the NestJS API and the
React frontend, without touching the existing tag-based scope system.

**Architecture:** Four new DB tables (`roles`, `role_permissions`,
`membership_roles`, `invite_roles`) replace `orgMemberships.role`/`roleLabel`
and `invites.roleLabel`. A `PermissionsGuard` + `@RequirePermission()`/
`@RequireSystemAdmin()` decorators replace `RolesGuard`/`@Roles()`, applied
to every gated controller. A new `/roles` + `/team` API manages roles and
assigns them to org members. The frontend mirrors this with `useAuth()`
exposing `permissions`/`isSystemAdmin`/`hasPermission()`, new route guards,
and two new settings pages.

**Tech Stack:** NestJS 11, Drizzle ORM (PostgreSQL), nestjs-zod, React 19 +
React Router 7 + TanStack Query, shadcn/ui, pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-09-24-rbac-design.md` (read this
first — it explains *why* role management is gated by `isSystemAdmin`
rather than a regular permission, and why scope stays untouched).

## Global Constraints

- No test framework exists anywhere in this repo (no Jest/Vitest, no
  `*.spec.ts` files). Verification in this plan uses TypeScript compilation
  (`pnpm --filter <pkg> build`), the drizzle migration tooling, `curl`
  against a running dev API, and manual browser checks — **do not** add a
  test framework as part of this change; that would be unrelated scope.
- `apps/api` is a single NestJS compilation unit. `decorators.ts`'s `Roles`
  export is removed in Task 3 and every consumer (`tags`, `rooms`,
  `invites` controllers) isn't migrated until Task 5. **`pnpm --filter
  @gembala/api build` will fail from Task 3 through the end of Task 4 —
  this is expected**, not a bug to fix mid-sequence. Task 5 is the first
  point the whole backend builds and runs again; treat it as the backend
  checkpoint. Do not introduce a temporary dual `Roles`/`RequirePermission`
  system to keep intermediate builds green — that's exactly the kind of
  backwards-compatibility shim to avoid.
- Every new/changed permission-relevant identifier must exactly match
  across files: the permission key format is always `"resource:action"`
  lowercase (e.g. `"members:create"`), produced only by the shared
  `permissionKey()` helper — never hand-typed as a raw string outside
  seed/migration SQL.
- The baseline "Leader" role's permission set must be **identical** in two
  places that can't share code (the migration's raw SQL and
  `auth.service.ts`'s seeding in `register()`): `members:read`,
  `members:create`, `members:update`, `groups:read`, `groups:create`,
  `groups:update`, `households:read`, `tags:read`, `rooms:read`,
  `events:read`. Keep both lists byte-identical.
- `pnpm --filter @gembala/api db:migrate` and `db:seed` require the dev
  Postgres running: `docker compose up -d` from the repo root first.

## Review Focus

- Migration must not lock out existing admin/leader memberships — Task 2
  seeds pre-migration data under the *old* schema first, then verifies
  every membership resolved to the right new role after migrating.
- A non-system-admin must never be able to grant the system Admin role via
  invite or team role-assignment — Task 5 verifies `/roles/assignable`
  excludes it for a non-admin and that a forced attempt is rejected
  server-side, not just hidden client-side.
- A membership with zero assigned roles (e.g. its only role got deleted)
  must not crash `/auth/me` or any guarded endpoint — Task 5 verifies it
  resolves to empty permissions, not a 500.
- Deleting a role currently assigned to members must cascade cleanly via
  the FK and leave affected users functional (fewer permissions, no
  error) — Task 5 verifies this explicitly.
- Direct navigation to `/settings/roles` or `/settings/team` by a
  non-system-admin must render a blocked state, not admin data or a
  crash — Task 8 and Task 10 both check this.

---

### Task 1: Shared permission catalog and RBAC types

**Files:**
- Modify: `packages/shared/src/schemas.ts`

**Interfaces:**
- Produces: `permissionResourceSchema`, `PermissionResource`,
  `permissionActionSchema`, `PermissionAction`, `permissionKey(resource,
  action): string`, `ALL_PERMISSIONS: string[]`, `roleCreateSchema`,
  `RoleCreateInput`, `roleUpdateSchema`, `RoleUpdateInput`, `RoleResponse`,
  `membershipRoleAssignSchema`, `MembershipRoleAssignInput`,
  `TeamMemberResponse`. Updated: `MeResponse`, `inviteCreateSchema`,
  `InviteCreateInput`, `InviteResponse`, `InvitePreviewResponse`. Removed:
  `membershipRoleSchema`, `MembershipRole`.

- [ ] **Step 1: Remove the old role enum**

Delete these two lines (currently right after `memberBaptismStatusSchema`):

```ts
export const membershipRoleSchema = z.enum(["admin", "leader"])
export type MembershipRole = z.infer<typeof membershipRoleSchema>
```

- [ ] **Step 2: Add the permission catalog**

In the same spot (Primitives section), add:

```ts
export const permissionResourceSchema = z.enum([
  "members",
  "groups",
  "households",
  "tags",
  "invites",
  "rooms",
  "events",
])
export type PermissionResource = z.infer<typeof permissionResourceSchema>

export const permissionActionSchema = z.enum(["create", "read", "update", "delete"])
export type PermissionAction = z.infer<typeof permissionActionSchema>

export function permissionKey(resource: PermissionResource, action: PermissionAction): string {
  return `${resource}:${action}`
}

export const ALL_PERMISSIONS: string[] = permissionResourceSchema.options.flatMap((resource) =>
  permissionActionSchema.options.map((action) => permissionKey(resource, action)),
)
```

- [ ] **Step 3: Update `MeResponse`**

Replace:

```ts
export type MeResponse = {
  user: { id: string; name: string; email: string }
  org: { id: string; name: string }
  role: MembershipRole
  roleLabel: string
  // null = admin / full access, mirrors the prototype's Viewer.scopeTags
  scopeTags: string[] | null
}
```

with:

```ts
export type MeResponse = {
  user: { id: string; name: string; email: string }
  org: { id: string; name: string }
  roles: { id: string; name: string }[]
  isSystemAdmin: boolean
  // full resolved "resource:action" set; irrelevant (and empty) when isSystemAdmin is true
  permissions: string[]
  // null = full access (isSystemAdmin), mirrors the prototype's Viewer.scopeTags
  scopeTags: string[] | null
}
```

- [ ] **Step 4: Add Role and Team types**

Add a new section right after the Auth section (after `AuthResponse`):

```ts
// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

export const roleCreateSchema = z.object({
  name: z.string().min(1).max(60),
  description: z.string().max(300).or(z.literal("")),
  permissions: z
    .array(z.string())
    .refine((perms) => perms.every((p) => (ALL_PERMISSIONS as string[]).includes(p)), {
      message: "invalid permission key",
    }),
})
export type RoleCreateInput = z.infer<typeof roleCreateSchema>

export const roleUpdateSchema = roleCreateSchema.partial()
export type RoleUpdateInput = z.infer<typeof roleUpdateSchema>

export type RoleResponse = {
  id: string
  name: string
  description: string
  isSystemAdmin: boolean
  permissions: string[]
  memberCount: number
}

export const membershipRoleAssignSchema = z.object({
  roleIds: z.array(z.string().uuid()),
})
export type MembershipRoleAssignInput = z.infer<typeof membershipRoleAssignSchema>

export type TeamMemberResponse = {
  membershipId: string
  user: { id: string; name: string; email: string }
  roles: { id: string; name: string }[]
  scopeTags: string[] | null
}
```

- [ ] **Step 5: Update invite schemas/types**

Replace:

```ts
export const inviteCreateSchema = z.object({
  email: z.string().email().max(255),
  roleLabel: z.string().min(1).max(100),
  scopeTags: z.array(tagNameSchema).min(1, "pick at least one scope tag"),
})
export type InviteCreateInput = z.infer<typeof inviteCreateSchema>

export type InviteResponse = {
  id: string
  email: string
  roleLabel: string
  scopeTags: string[]
  status: "pending" | "accepted" | "revoked" | "expired"
  createdAt: string
  expiresAt: string
}

export type InvitePreviewResponse = {
  orgName: string
  email: string
  roleLabel: string
  scopeTags: string[]
}
```

with:

```ts
export const inviteCreateSchema = z.object({
  email: z.string().email().max(255),
  roleIds: z.array(z.string().uuid()).min(1, "pick at least one role"),
  scopeTags: z.array(tagNameSchema).min(1, "pick at least one scope tag"),
})
export type InviteCreateInput = z.infer<typeof inviteCreateSchema>

export type InviteResponse = {
  id: string
  email: string
  roles: { id: string; name: string }[]
  scopeTags: string[]
  status: "pending" | "accepted" | "revoked" | "expired"
  createdAt: string
  expiresAt: string
}

export type InvitePreviewResponse = {
  orgName: string
  email: string
  roles: { id: string; name: string }[]
  scopeTags: string[]
}
```

- [ ] **Step 6: Verify the package builds standalone**

Run: `pnpm --filter @gembala/shared build`
Expected: succeeds with no errors (this package doesn't reference `apps/api`
or `apps/web`, so it type-checks independently of them).

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/schemas.ts
git commit -m "feat(shared): add RBAC permission catalog and role types"
```

---

### Task 2: Database schema, migration, and seed data

**Files:**
- Modify: `apps/api/src/db/schema.ts`
- Create: `apps/api/drizzle/00XX_<generated-name>.sql` (name is random,
  generated by drizzle-kit)
- Modify: `apps/api/src/db/seed-data.ts`
- Modify: `apps/api/src/db/seed.ts`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `roles`, `rolePermissions`, `membershipRoles`, `inviteRoles`
  Drizzle table objects exported from `schema.ts`, used by every backend
  task after this one.

- [ ] **Step 1: Remove the old role enum and columns**

In `apps/api/src/db/schema.ts`, delete this line:

```ts
export const membershipRole = pgEnum("membership_role", ["admin", "leader"])
```

In the `orgMemberships` table, delete these two field lines:

```ts
    role: membershipRole("role").notNull(),
    roleLabel: text("role_label").notNull(),
```

In the `invites` table, delete this field line:

```ts
    roleLabel: text("role_label").notNull(),
```

- [ ] **Step 2: Add the new tables**

Immediately after the `membershipScopeTags` table definition, add:

```ts
export const roles = pgTable(
  "roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    // true only for the seeded, protected "Admin" role — see the design
    // spec's "System admin role" section for why this isn't a permission.
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
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    // "resource:action", e.g. "members:create". Validated against the
    // shared ALL_PERMISSIONS list at the application layer, not a DB enum.
    permission: text("permission").notNull(),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permission] })],
)

export const membershipRoles = pgTable(
  "membership_roles",
  {
    membershipId: uuid("membership_id")
      .notNull()
      .references(() => orgMemberships.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.membershipId, t.roleId] })],
)
```

Immediately after the `inviteScopeTags` table definition, add:

```ts
export const inviteRoles = pgTable(
  "invite_roles",
  {
    inviteId: uuid("invite_id")
      .notNull()
      .references(() => invites.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.inviteId, t.roleId] })],
)
```

- [ ] **Step 3: Seed pre-migration data to prove the migration is safe**

```bash
docker compose up -d
pnpm --filter @gembala/api db:seed
```

Expected: `Seeded "Gembala Demo Church".` with 4 logins printed. This
creates one `admin` and three `leader` `org_memberships` rows **under the
current (pre-change) schema** — exactly the data shape the migration's
data-migration step below must handle correctly. Leave this data in place;
Step 6 verifies against it.

- [ ] **Step 4: Generate the migration**

```bash
pnpm --filter @gembala/api db:generate
```

This diffs the schema.ts edits from Steps 1-2 against the last snapshot and
writes a new `apps/api/drizzle/00XX_<random-name>.sql` (the name is
randomly generated — note it for the next step) plus an updated
`meta/00XX_snapshot.json` and `meta/_journal.json`.

- [ ] **Step 5: Insert the data migration**

Open the generated `00XX_<random-name>.sql`. It will contain, in some
order: `CREATE TABLE` statements for `roles`, `role_permissions`,
`membership_roles`, `invite_roles`; their FK/index `ALTER TABLE`/`CREATE
INDEX` statements; and finally `ALTER TABLE "org_memberships" DROP COLUMN
"role";`, `ALTER TABLE "org_memberships" DROP COLUMN "role_label";`,
`ALTER TABLE "invites" DROP COLUMN "role_label";`, and `DROP TYPE
"public"."membership_role";`.

Insert the following block on its own line **directly above** the first
`DROP COLUMN` statement (so it runs after the new tables exist but before
the old columns it reads are dropped), keeping every generated statement
otherwise unchanged:

```sql
-- Seed one protected "Admin" role and one starter "Leader" role per existing org.
INSERT INTO "roles" ("id", "org_id", "name", "description", "is_system_admin")
SELECT gen_random_uuid(), "id", 'Admin', 'Full access to everything.', true FROM "organizations";
--> statement-breakpoint
INSERT INTO "roles" ("id", "org_id", "name", "description", "is_system_admin")
SELECT gen_random_uuid(), "id", 'Leader', 'Read/write members and groups; read-only elsewhere.', false FROM "organizations";
--> statement-breakpoint
-- Baseline permission set for every org's new "Leader" role — keep this list
-- byte-identical to LEADER_BASELINE_PERMISSIONS in apps/api/src/auth/auth.service.ts.
INSERT INTO "role_permissions" ("role_id", "permission")
SELECT r."id", p.permission
FROM "roles" r
CROSS JOIN (VALUES
  ('members:read'), ('members:create'), ('members:update'),
  ('groups:read'), ('groups:create'), ('groups:update'),
  ('households:read'), ('tags:read'), ('rooms:read'), ('events:read')
) AS p(permission)
WHERE r."name" = 'Leader';
--> statement-breakpoint
-- Attach every existing admin membership to its org's new Admin role.
INSERT INTO "membership_roles" ("membership_id", "role_id")
SELECT om."id", r."id"
FROM "org_memberships" om
JOIN "roles" r ON r."org_id" = om."org_id" AND r."name" = 'Admin'
WHERE om."role" = 'admin';
--> statement-breakpoint
-- Attach every existing leader membership to its org's new Leader role.
INSERT INTO "membership_roles" ("membership_id", "role_id")
SELECT om."id", r."id"
FROM "org_memberships" om
JOIN "roles" r ON r."org_id" = om."org_id" AND r."name" = 'Leader'
WHERE om."role" = 'leader';
--> statement-breakpoint
```

- [ ] **Step 6: Apply the migration and verify no lockout**

```bash
pnpm --filter @gembala/api db:migrate
```

Expected: succeeds with no errors.

```bash
docker compose exec db psql -U gembala -d gembala -c "
SELECT u.email, r.name AS role_name, r.is_system_admin
FROM membership_roles mr
JOIN roles r ON r.id = mr.role_id
JOIN org_memberships om ON om.id = mr.membership_id
JOIN users u ON u.id = om.user_id
ORDER BY u.email;"
```

Expected: 4 rows — `pastor.david@gembala.dev` → `Admin` /
`is_system_admin = t`, and `andrew@`, `hana@`, `gerald@gembala.dev` each →
`Leader` / `is_system_admin = f`. This confirms the seeded pre-migration
admin/leader memberships correctly resolved to the new roles.

- [ ] **Step 7: Update seed data for the new shape**

In `apps/api/src/db/seed-data.ts`, replace the `SeedUser` type and
`seedUsers` array:

```ts
export type SeedUser = {
  name: string
  email: string
  roleNames: string[]
  scopeTags: string[] | null
}
```

```ts
export const seedUsers: SeedUser[] = [
  { name: "Pastor David", email: "pastor.david@gembala.dev", roleNames: ["Admin"], scopeTags: null },
  { name: "Andrew Tanu", email: "andrew@gembala.dev", roleNames: ["Leader"], scopeTags: ["youth"] },
  { name: "Hana Kusuma", email: "hana@gembala.dev", roleNames: ["Leader"], scopeTags: ["worship"] },
  { name: "Gerald Manik", email: "gerald@gembala.dev", roleNames: ["Leader"], scopeTags: ["married"] },
]
```

- [ ] **Step 8: Update the seed script**

In `apps/api/src/db/seed.ts`, add `roles`/`rolePermissions`/`membershipRoles`
to the `schema` usage (already imported via `import * as schema from
"./schema"`, no import line changes needed). Insert role seeding right
after the tags loop (before the members loop), and replace the users loop:

```ts
    const LEADER_BASELINE_PERMISSIONS = [
      "members:read", "members:create", "members:update",
      "groups:read", "groups:create", "groups:update",
      "households:read", "tags:read", "rooms:read", "events:read",
    ]

    const [adminRole] = await tx
      .insert(schema.roles)
      .values({ orgId: org.id, name: "Admin", description: "Full access to everything.", isSystemAdmin: true })
      .returning()
    const [leaderRole] = await tx
      .insert(schema.roles)
      .values({ orgId: org.id, name: "Leader", description: "Read/write members and groups; read-only elsewhere." })
      .returning()
    await tx.insert(schema.rolePermissions).values(
      LEADER_BASELINE_PERMISSIONS.map((permission) => ({ roleId: leaderRole.id, permission })),
    )
    const roleIdByName = new Map([["Admin", adminRole.id], ["Leader", leaderRole.id]])
```

(place this block right after the `const [org] = await tx.insert(...)` line,
before the tags loop — it only needs `org.id`)

Then replace the users loop:

```ts
    for (const u of seedUsers) {
      const [user] = await tx
        .insert(schema.users)
        .values({ email: u.email, name: u.name, passwordHash })
        .returning()
      const [membership] = await tx
        .insert(schema.orgMemberships)
        .values({ orgId: org.id, userId: user.id })
        .returning()
      await tx.insert(schema.membershipRoles).values(
        u.roleNames.map((name) => ({ membershipId: membership.id, roleId: roleIdByName.get(name)! })),
      )
      if (u.scopeTags) {
        await tx.insert(schema.membershipScopeTags).values(
          u.scopeTags.map((t) => ({ membershipId: membership.id, tagId: tagIdByName.get(t)! })),
        )
      }
    }
```

And the final log line:

```ts
  for (const u of seedUsers) console.log(`  ${u.email} — ${u.roleNames.join(", ")}`)
```

- [ ] **Step 9: Re-seed against the new schema to confirm the script works**

```bash
docker compose exec db psql -U gembala -d gembala -c "DELETE FROM organizations WHERE name = 'Gembala Demo Church';"
pnpm --filter @gembala/api db:seed
```

Expected: succeeds, prints the 4 logins. (The `DELETE FROM organizations`
cascades to every table seeded in Step 3, including the old-shape rows —
this deliberately clears the pre-migration test data so the script is
re-verified end-to-end under the new schema.)

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/db/schema.ts apps/api/drizzle apps/api/src/db/seed-data.ts apps/api/src/db/seed.ts
git commit -m "feat(api): add roles/permissions tables, migrate off the role enum"
```

---

### Task 3: Authz core — AuthContext, decorators, guard, auth service

**Files:**
- Modify: `apps/api/src/authz/auth-context.ts`
- Modify: `apps/api/src/authz/auth-context.service.ts`
- Modify: `apps/api/src/authz/decorators.ts`
- Create: `apps/api/src/authz/permissions.guard.ts`
- Delete: `apps/api/src/authz/roles.guard.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/src/auth/auth.service.ts`

**Interfaces:**
- Consumes: `roles`, `rolePermissions`, `membershipRoles` from Task 2;
  `PermissionResource`, `PermissionAction`, `permissionKey` from Task 1.
- Produces: `AuthContext` shape (`roles`, `isSystemAdmin`, `permissions:
  Set<string>`), `RequirePermission(resource, action)`,
  `RequireSystemAdmin()` decorators, `PermissionsGuard`. Every later task
  that touches a controller depends on these two decorators existing.

- [ ] **Step 1: Rewrite `AuthContext`**

Replace the whole file:

```ts
export type AuthContext = {
  userId: string
  userName: string
  userEmail: string
  orgId: string
  orgName: string
  membershipId: string
  roles: { id: string; name: string }[]
  isSystemAdmin: boolean
  // union of every assigned role's permissions; irrelevant (and empty) when isSystemAdmin
  permissions: Set<string>
  // null = full access (isSystemAdmin), mirrors the prototype's Viewer.scopeTags
  scopeTagNames: string[] | null
}
```

- [ ] **Step 2: Rewrite the decorators**

Replace the whole file:

```ts
import {
  createParamDecorator,
  SetMetadata,
  type ExecutionContext,
} from "@nestjs/common"
import { permissionKey, type PermissionAction, type PermissionResource } from "@gembala/shared"
import type { AuthContext } from "./auth-context"

export const IS_PUBLIC_KEY = "isPublic"
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true)

export const PERMISSION_KEY = "permission"
export const RequirePermission = (resource: PermissionResource, action: PermissionAction) =>
  SetMetadata(PERMISSION_KEY, permissionKey(resource, action))

export const SYSTEM_ADMIN_KEY = "systemAdmin"
export const RequireSystemAdmin = () => SetMetadata(SYSTEM_ADMIN_KEY, true)

export const CurrentAuth = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthContext => {
    return ctx.switchToHttp().getRequest().auth
  },
)
```

- [ ] **Step 3: Create the permissions guard**

Create `apps/api/src/authz/permissions.guard.ts`:

```ts
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common"
import { Reflector } from "@nestjs/core"
import type { AuthContext } from "./auth-context"
import { PERMISSION_KEY, SYSTEM_ADMIN_KEY } from "./decorators"

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const auth: AuthContext | undefined = ctx.switchToHttp().getRequest().auth

    const requireSystemAdmin = this.reflector.getAllAndOverride<boolean>(SYSTEM_ADMIN_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ])
    if (requireSystemAdmin) {
      if (!auth?.isSystemAdmin) throw new ForbiddenException("admin access required")
      return true
    }

    const requiredPermission = this.reflector.getAllAndOverride<string>(PERMISSION_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ])
    if (!requiredPermission) return true

    if (!auth || (!auth.isSystemAdmin && !auth.permissions.has(requiredPermission))) {
      throw new ForbiddenException(`missing permission: ${requiredPermission}`)
    }
    return true
  }
}
```

- [ ] **Step 4: Delete the old guard**

```bash
git rm apps/api/src/authz/roles.guard.ts
```

- [ ] **Step 5: Rewrite `AuthContextService.load`**

Replace the whole file:

```ts
import { Injectable } from "@nestjs/common"
import { eq, inArray } from "drizzle-orm"
import { InjectDb, type Db } from "../db/drizzle.module"
import {
  membershipRoles,
  membershipScopeTags,
  organizations,
  orgMemberships,
  rolePermissions,
  roles,
  tags,
  users,
} from "../db/schema"
import type { AuthContext } from "./auth-context"

@Injectable()
export class AuthContextService {
  constructor(@InjectDb() private readonly db: Db) {}

  // Role, permission, and scope are read fresh from the DB every call
  // (never cached in a token), so permission changes take effect
  // immediately. Shared by JwtAuthGuard (keyed off a verified JWT's
  // subject) and TelegramService (keyed off a linked Telegram chat's
  // userId — no JWT involved at all).
  async load(userId: string): Promise<AuthContext | null> {
    const rows = await this.db
      .select({
        userId: users.id,
        userName: users.name,
        userEmail: users.email,
        membershipId: orgMemberships.id,
        orgId: organizations.id,
        orgName: organizations.name,
      })
      .from(users)
      .innerJoin(orgMemberships, eq(orgMemberships.userId, users.id))
      .innerJoin(organizations, eq(organizations.id, orgMemberships.orgId))
      .where(eq(users.id, userId))
      .limit(1)

    const row = rows[0]
    if (!row) return null

    const roleRows = await this.db
      .select({ id: roles.id, name: roles.name, isSystemAdmin: roles.isSystemAdmin })
      .from(membershipRoles)
      .innerJoin(roles, eq(roles.id, membershipRoles.roleId))
      .where(eq(membershipRoles.membershipId, row.membershipId))

    const isSystemAdmin = roleRows.some((r) => r.isSystemAdmin)

    let permissions = new Set<string>()
    if (!isSystemAdmin && roleRows.length > 0) {
      const permRows = await this.db
        .select({ permission: rolePermissions.permission })
        .from(rolePermissions)
        .where(
          inArray(
            rolePermissions.roleId,
            roleRows.map((r) => r.id),
          ),
        )
      permissions = new Set(permRows.map((r) => r.permission))
    }

    let scopeTagNames: string[] | null = null
    if (!isSystemAdmin) {
      const scopeRows = await this.db
        .select({ name: tags.name })
        .from(membershipScopeTags)
        .innerJoin(tags, eq(tags.id, membershipScopeTags.tagId))
        .where(eq(membershipScopeTags.membershipId, row.membershipId))
      scopeTagNames = scopeRows.map((r) => r.name)
    }

    return {
      ...row,
      roles: roleRows.map((r) => ({ id: r.id, name: r.name })),
      isSystemAdmin,
      permissions,
      scopeTagNames,
    }
  }
}
```

- [ ] **Step 6: Register the new guard in `app.module.ts`**

Replace:

```ts
import { RolesGuard } from "./authz/roles.guard"
```

with:

```ts
import { PermissionsGuard } from "./authz/permissions.guard"
```

Replace:

```ts
    { provide: APP_GUARD, useClass: RolesGuard },
```

with:

```ts
    { provide: APP_GUARD, useClass: PermissionsGuard },
```

- [ ] **Step 7: Rewrite `auth.service.ts`**

Replace the whole file:

```ts
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { JwtService } from "@nestjs/jwt"
import type {
  AcceptInviteInput,
  AuthResponse,
  LoginInput,
  MeResponse,
  RegisterInput,
  ResetPasswordInput,
} from "@gembala/shared"
import * as argon2 from "argon2"
import { createHash, randomBytes } from "node:crypto"
import { and, eq, gt, isNull } from "drizzle-orm"
import { InjectDb, type Db } from "../db/drizzle.module"
import {
  invites,
  inviteRoles,
  inviteScopeTags,
  membershipRoles,
  membershipScopeTags,
  organizations,
  orgMemberships,
  passwordResetTokens,
  roles,
  rolePermissions,
  tags,
  users,
} from "../db/schema"
import type { AuthContext } from "../authz/auth-context"
import { AuthContextService } from "../authz/auth-context.service"
import { MailService } from "../mail/mail.service"

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex")

// Keep byte-identical to the migration's data-migration SQL — see Global
// Constraints in the RBAC implementation plan.
const LEADER_BASELINE_PERMISSIONS = [
  "members:read", "members:create", "members:update",
  "groups:read", "groups:create", "groups:update",
  "households:read", "tags:read", "rooms:read", "events:read",
]

@Injectable()
export class AuthService {
  constructor(
    @InjectDb() private readonly db: Db,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
    private readonly authContext: AuthContextService,
  ) {}

  meFromContext(auth: AuthContext): MeResponse {
    return {
      user: { id: auth.userId, name: auth.userName, email: auth.userEmail },
      org: { id: auth.orgId, name: auth.orgName },
      roles: auth.roles,
      isSystemAdmin: auth.isSystemAdmin,
      permissions: [...auth.permissions],
      scopeTags: auth.scopeTagNames,
    }
  }

  async register(input: RegisterInput): Promise<AuthResponse> {
    const email = input.email.toLowerCase()
    const existing = await this.db.select({ id: users.id }).from(users).where(eq(users.email, email))
    if (existing.length > 0) throw new ConflictException("an account with this email already exists")

    const passwordHash = await argon2.hash(input.password)

    const created = await this.db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({ email, name: input.name, passwordHash })
        .returning()
      const [org] = await tx
        .insert(organizations)
        .values({ name: input.organizationName })
        .returning()
      const [membership] = await tx
        .insert(orgMemberships)
        .values({ orgId: org.id, userId: user.id })
        .returning()
      const [adminRole] = await tx
        .insert(roles)
        .values({ orgId: org.id, name: "Admin", description: "Full access to everything.", isSystemAdmin: true })
        .returning()
      const [leaderRole] = await tx
        .insert(roles)
        .values({ orgId: org.id, name: "Leader", description: "Read/write members and groups; read-only elsewhere." })
        .returning()
      await tx.insert(rolePermissions).values(
        LEADER_BASELINE_PERMISSIONS.map((permission) => ({ roleId: leaderRole.id, permission })),
      )
      await tx.insert(membershipRoles).values({ membershipId: membership.id, roleId: adminRole.id })
      // every org starts with the root directory tag the UI expects
      await tx.insert(tags).values({ orgId: org.id, name: "members", description: "Everyone in the church directory" })
      return { user, org, membership }
    })

    return this.buildAuthResponse(created.user.id)
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    const email = input.email.toLowerCase()
    const [user] = await this.db.select().from(users).where(eq(users.email, email))
    if (!user || !(await argon2.verify(user.passwordHash, input.password))) {
      throw new UnauthorizedException("invalid email or password")
    }
    return this.buildAuthResponse(user.id)
  }

  async forgotPassword(email: string): Promise<void> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
    // Always resolve silently — never reveal whether the email exists.
    if (!user) return

    const token = randomBytes(32).toString("hex")
    await this.db.insert(passwordResetTokens).values({
      userId: user.id,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })

    const webOrigin = this.config.getOrThrow<string>("WEB_ORIGIN")
    await this.mail.sendPasswordReset(user.email, `${webOrigin}/reset-password?token=${token}`)
  }

  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const [row] = await this.db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.tokenHash, sha256(input.token)),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, new Date()),
        ),
      )
    if (!row) throw new UnauthorizedException("invalid or expired reset link")

    const passwordHash = await argon2.hash(input.password)
    await this.db.transaction(async (tx) => {
      await tx.update(users).set({ passwordHash }).where(eq(users.id, row.userId))
      // burn every outstanding token for this user, not just the one used
      await tx
        .update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(and(eq(passwordResetTokens.userId, row.userId), isNull(passwordResetTokens.usedAt)))
    })
  }

  async acceptInvite(input: AcceptInviteInput): Promise<AuthResponse> {
    const [invite] = await this.db
      .select()
      .from(invites)
      .where(eq(invites.tokenHash, sha256(input.token)))
    if (!invite || invite.revokedAt || invite.acceptedAt || invite.expiresAt < new Date()) {
      throw new UnauthorizedException("invalid or expired invite")
    }

    const email = invite.email.toLowerCase()
    const existing = await this.db.select({ id: users.id }).from(users).where(eq(users.email, email))
    if (existing.length > 0) {
      throw new ConflictException("this email already has an account")
    }

    const passwordHash = await argon2.hash(input.password)

    const userId = await this.db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({ email, name: input.name, passwordHash })
        .returning()
      const [membership] = await tx
        .insert(orgMemberships)
        .values({ orgId: invite.orgId, userId: user.id })
        .returning()
      const scopeRows = await tx
        .select({ tagId: inviteScopeTags.tagId })
        .from(inviteScopeTags)
        .where(eq(inviteScopeTags.inviteId, invite.id))
      if (scopeRows.length > 0) {
        await tx.insert(membershipScopeTags).values(
          scopeRows.map((r) => ({ membershipId: membership.id, tagId: r.tagId })),
        )
      }
      const roleRows = await tx
        .select({ roleId: inviteRoles.roleId })
        .from(inviteRoles)
        .where(eq(inviteRoles.inviteId, invite.id))
      if (roleRows.length > 0) {
        await tx.insert(membershipRoles).values(
          roleRows.map((r) => ({ membershipId: membership.id, roleId: r.roleId })),
        )
      }
      await tx.update(invites).set({ acceptedAt: new Date() }).where(eq(invites.id, invite.id))
      return user.id
    })

    return this.buildAuthResponse(userId)
  }

  private async buildAuthResponse(userId: string): Promise<AuthResponse> {
    const token = await this.jwt.signAsync({ sub: userId })
    const auth = await this.authContext.load(userId)
    if (!auth) throw new UnauthorizedException("user no longer exists")
    return { token, me: this.meFromContext(auth) }
  }
}
```

Note: `AuthContextService` is exported by the `@Global()` `AuthzModule`
(`apps/api/src/authz/authz.module.ts`), so it's injectable here without any
module import changes.

- [ ] **Step 8: Verify — read-only, no build gate yet**

This task cannot type-check on its own: `tags.controller.ts`,
`rooms.controller.ts`, and `invites.controller.ts` still import the now-
deleted `Roles`/`ROLES_KEY` from `decorators.ts`, and `invites.service.ts`
still writes to the now-removed `invites.roleLabel` column. That's expected
per Global Constraints — Task 5 is the build checkpoint. Read back the
7 files touched in this task to confirm they're internally consistent
before committing.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/authz apps/api/src/app.module.ts apps/api/src/auth/auth.service.ts
git commit -m "feat(api): replace role-based guard with permission-based guard"
```

---

### Task 4: Roles + Team backend module

**Files:**
- Create: `apps/api/src/roles/roles.service.ts`
- Create: `apps/api/src/roles/roles.controller.ts`
- Create: `apps/api/src/roles/team.controller.ts`
- Create: `apps/api/src/roles/roles.module.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Consumes: `RequirePermission`, `RequireSystemAdmin`, `CurrentAuth` from
  Task 3; `roles`, `rolePermissions`, `membershipRoles` tables from Task 2;
  `RoleCreateInput`, `RoleUpdateInput`, `RoleResponse`,
  `MembershipRoleAssignInput`, `TeamMemberResponse` from Task 1.
- Produces: `RolesService` with `list(orgId)`, `assignableRoles(auth)`,
  `create(orgId, input)`, `update(orgId, id, input)`, `remove(orgId, id)`,
  `team(orgId)`, `assignRoles(auth, membershipId, roleIds)` — Task 5's
  rewritten `InvitesService` depends on `assignableRoles`.

- [ ] **Step 1: Create `roles.service.ts`**

```ts
import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common"
import { and, eq, inArray } from "drizzle-orm"
import type { RoleCreateInput, RoleResponse, RoleUpdateInput, TeamMemberResponse } from "@gembala/shared"
import { InjectDb, type Db } from "../db/drizzle.module"
import {
  membershipRoles,
  membershipScopeTags,
  orgMemberships,
  rolePermissions,
  roles,
  tags,
  users,
} from "../db/schema"
import type { AuthContext } from "../authz/auth-context"

@Injectable()
export class RolesService {
  constructor(@InjectDb() private readonly db: Db) {}

  async list(orgId: string): Promise<RoleResponse[]> {
    const roleRows = await this.db.select().from(roles).where(eq(roles.orgId, orgId))
    if (roleRows.length === 0) return []
    const roleIds = roleRows.map((r) => r.id)

    const permRows = await this.db
      .select()
      .from(rolePermissions)
      .where(inArray(rolePermissions.roleId, roleIds))
    const permsByRole = new Map<string, string[]>()
    for (const p of permRows) {
      const list = permsByRole.get(p.roleId) ?? []
      list.push(p.permission)
      permsByRole.set(p.roleId, list)
    }

    const memberRows = await this.db
      .select()
      .from(membershipRoles)
      .where(inArray(membershipRoles.roleId, roleIds))
    const countByRole = new Map<string, number>()
    for (const m of memberRows) {
      countByRole.set(m.roleId, (countByRole.get(m.roleId) ?? 0) + 1)
    }

    return roleRows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      isSystemAdmin: r.isSystemAdmin,
      permissions: permsByRole.get(r.id) ?? [],
      memberCount: countByRole.get(r.id) ?? 0,
    }))
  }

  // Roles a caller may grant to someone else (invite / membership edit):
  // every role in the org except isSystemAdmin ones — unless the caller is
  // themselves a system admin. Prevents a non-admin from minting a new Admin.
  async assignableRoles(auth: AuthContext): Promise<RoleResponse[]> {
    const all = await this.list(auth.orgId)
    return auth.isSystemAdmin ? all : all.filter((r) => !r.isSystemAdmin)
  }

  async create(orgId: string, input: RoleCreateInput): Promise<RoleResponse> {
    const [existing] = await this.db
      .select({ id: roles.id })
      .from(roles)
      .where(and(eq(roles.orgId, orgId), eq(roles.name, input.name)))
    if (existing) throw new ConflictException("a role with this name already exists")

    const created = await this.db.transaction(async (tx) => {
      const [role] = await tx
        .insert(roles)
        .values({ orgId, name: input.name, description: input.description })
        .returning()
      if (input.permissions.length > 0) {
        await tx.insert(rolePermissions).values(
          input.permissions.map((permission) => ({ roleId: role.id, permission })),
        )
      }
      return role
    })

    return {
      id: created.id,
      name: created.name,
      description: created.description,
      isSystemAdmin: false,
      permissions: input.permissions,
      memberCount: 0,
    }
  }

  async update(orgId: string, id: string, input: RoleUpdateInput): Promise<RoleResponse> {
    const [role] = await this.db
      .select()
      .from(roles)
      .where(and(eq(roles.id, id), eq(roles.orgId, orgId)))
    if (!role) throw new NotFoundException("role not found")
    if (role.isSystemAdmin) throw new ForbiddenException("the Admin role can't be edited")

    await this.db.transaction(async (tx) => {
      if (input.name !== undefined || input.description !== undefined) {
        await tx
          .update(roles)
          .set({
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.description !== undefined ? { description: input.description } : {}),
          })
          .where(eq(roles.id, id))
      }
      if (input.permissions !== undefined) {
        await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, id))
        if (input.permissions.length > 0) {
          await tx.insert(rolePermissions).values(
            input.permissions.map((permission) => ({ roleId: id, permission })),
          )
        }
      }
    })

    const all = await this.list(orgId)
    return all.find((r) => r.id === id)!
  }

  async remove(orgId: string, id: string): Promise<void> {
    const [role] = await this.db
      .select()
      .from(roles)
      .where(and(eq(roles.id, id), eq(roles.orgId, orgId)))
    if (!role) throw new NotFoundException("role not found")
    if (role.isSystemAdmin) throw new ForbiddenException("the Admin role can't be deleted")
    await this.db.delete(roles).where(eq(roles.id, id))
  }

  async team(orgId: string): Promise<TeamMemberResponse[]> {
    const memberships = await this.db
      .select({
        membershipId: orgMemberships.id,
        userId: users.id,
        userName: users.name,
        userEmail: users.email,
      })
      .from(orgMemberships)
      .innerJoin(users, eq(users.id, orgMemberships.userId))
      .where(eq(orgMemberships.orgId, orgId))
    if (memberships.length === 0) return []
    const membershipIds = memberships.map((m) => m.membershipId)

    const roleRows = await this.db
      .select({
        membershipId: membershipRoles.membershipId,
        roleId: roles.id,
        roleName: roles.name,
        isSystemAdmin: roles.isSystemAdmin,
      })
      .from(membershipRoles)
      .innerJoin(roles, eq(roles.id, membershipRoles.roleId))
      .where(inArray(membershipRoles.membershipId, membershipIds))
    const rolesByMembership = new Map<string, { id: string; name: string }[]>()
    const isSystemAdminByMembership = new Map<string, boolean>()
    for (const r of roleRows) {
      const list = rolesByMembership.get(r.membershipId) ?? []
      list.push({ id: r.roleId, name: r.roleName })
      rolesByMembership.set(r.membershipId, list)
      if (r.isSystemAdmin) isSystemAdminByMembership.set(r.membershipId, true)
    }

    const scopeRows = await this.db
      .select({ membershipId: membershipScopeTags.membershipId, name: tags.name })
      .from(membershipScopeTags)
      .innerJoin(tags, eq(tags.id, membershipScopeTags.tagId))
      .where(inArray(membershipScopeTags.membershipId, membershipIds))
    const scopeByMembership = new Map<string, string[]>()
    for (const r of scopeRows) {
      const list = scopeByMembership.get(r.membershipId) ?? []
      list.push(r.name)
      scopeByMembership.set(r.membershipId, list)
    }

    return memberships.map((m) => ({
      membershipId: m.membershipId,
      user: { id: m.userId, name: m.userName, email: m.userEmail },
      roles: rolesByMembership.get(m.membershipId) ?? [],
      scopeTags: isSystemAdminByMembership.get(m.membershipId)
        ? null
        : (scopeByMembership.get(m.membershipId) ?? []),
    }))
  }

  async assignRoles(auth: AuthContext, membershipId: string, roleIds: string[]): Promise<void> {
    const [membership] = await this.db
      .select({ id: orgMemberships.id })
      .from(orgMemberships)
      .where(and(eq(orgMemberships.id, membershipId), eq(orgMemberships.orgId, auth.orgId)))
    if (!membership) throw new NotFoundException("team member not found")

    if (roleIds.length > 0) {
      const grantable = await this.assignableRoles(auth)
      const grantableIds = new Set(grantable.map((r) => r.id))
      if (!roleIds.every((id) => grantableIds.has(id))) {
        throw new ForbiddenException("you can't assign a role you don't have access to grant")
      }
    }

    await this.db.transaction(async (tx) => {
      await tx.delete(membershipRoles).where(eq(membershipRoles.membershipId, membershipId))
      if (roleIds.length > 0) {
        await tx.insert(membershipRoles).values(roleIds.map((roleId) => ({ membershipId, roleId })))
      }
    })
  }
}
```

- [ ] **Step 2: Create `roles.controller.ts`**

```ts
import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from "@nestjs/common"
import { createZodDto } from "nestjs-zod"
import { roleCreateSchema, roleUpdateSchema, type RoleResponse } from "@gembala/shared"
import { CurrentAuth, RequirePermission, RequireSystemAdmin } from "../authz/decorators"
import type { AuthContext } from "../authz/auth-context"
import { RolesService } from "./roles.service"

class RoleCreateDto extends createZodDto(roleCreateSchema) {}
class RoleUpdateDto extends createZodDto(roleUpdateSchema) {}

@Controller("roles")
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @RequireSystemAdmin()
  @Get()
  list(@CurrentAuth() auth: AuthContext): Promise<RoleResponse[]> {
    return this.roles.list(auth.orgId)
  }

  // Not system-admin-only: a non-admin inviter needs this to build an
  // invite, but only ever sees roles they're allowed to grant.
  @RequirePermission("invites", "create")
  @Get("assignable")
  assignable(@CurrentAuth() auth: AuthContext): Promise<RoleResponse[]> {
    return this.roles.assignableRoles(auth)
  }

  @RequireSystemAdmin()
  @Post()
  create(@CurrentAuth() auth: AuthContext, @Body() dto: RoleCreateDto): Promise<RoleResponse> {
    return this.roles.create(auth.orgId, dto)
  }

  @RequireSystemAdmin()
  @Patch(":id")
  update(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: RoleUpdateDto,
  ): Promise<RoleResponse> {
    return this.roles.update(auth.orgId, id, dto)
  }

  @RequireSystemAdmin()
  @HttpCode(204)
  @Delete(":id")
  async remove(@CurrentAuth() auth: AuthContext, @Param("id", ParseUUIDPipe) id: string): Promise<void> {
    await this.roles.remove(auth.orgId, id)
  }
}
```

Route ordering note: `GET /roles/assignable` is declared before any
`GET /roles/:id` — there isn't one in this controller, so no conflict, but
keep it above any future `:id` route you might add.

- [ ] **Step 3: Create `team.controller.ts`**

```ts
import { Body, Controller, Get, Param, ParseUUIDPipe, Put } from "@nestjs/common"
import { createZodDto } from "nestjs-zod"
import { membershipRoleAssignSchema, type TeamMemberResponse } from "@gembala/shared"
import { CurrentAuth, RequireSystemAdmin } from "../authz/decorators"
import type { AuthContext } from "../authz/auth-context"
import { RolesService } from "./roles.service"

class MembershipRoleAssignDto extends createZodDto(membershipRoleAssignSchema) {}

@Controller("team")
@RequireSystemAdmin()
export class TeamController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  list(@CurrentAuth() auth: AuthContext): Promise<TeamMemberResponse[]> {
    return this.roles.team(auth.orgId)
  }

  @Put(":membershipId/roles")
  async assignRoles(
    @CurrentAuth() auth: AuthContext,
    @Param("membershipId", ParseUUIDPipe) membershipId: string,
    @Body() dto: MembershipRoleAssignDto,
  ): Promise<void> {
    await this.roles.assignRoles(auth, membershipId, dto.roleIds)
  }
}
```

- [ ] **Step 4: Create `roles.module.ts`**

```ts
import { Module } from "@nestjs/common"
import { RolesController } from "./roles.controller"
import { TeamController } from "./team.controller"
import { RolesService } from "./roles.service"

@Module({
  controllers: [RolesController, TeamController],
  providers: [RolesService],
  exports: [RolesService],
})
export class RolesModule {}
```

- [ ] **Step 5: Register in `app.module.ts`**

Add the import:

```ts
import { RolesModule } from "./roles/roles.module"
```

Replace:

```ts
    InvitesModule,
    TelegramModule,
```

with:

```ts
    InvitesModule,
    RolesModule,
    TelegramModule,
```

- [ ] **Step 6: Verify — still no full build gate**

`tags.controller.ts`, `rooms.controller.ts`, `invites.controller.ts`, and
`invites.service.ts` still reference the removed `Roles` decorator and
`roleLabel` column — the app still won't build. That's resolved in Task 5.
Read back the 5 files from this task to confirm they're internally
consistent before committing.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/roles apps/api/src/app.module.ts
git commit -m "feat(api): add roles and team management endpoints"
```

---

### Task 5: Gate every resource controller + rewrite invites — backend checkpoint

**Files:**
- Modify: `apps/api/src/members/members.controller.ts`
- Modify: `apps/api/src/groups/groups.controller.ts`
- Modify: `apps/api/src/households/households.controller.ts`
- Modify: `apps/api/src/tags/tags.controller.ts`
- Modify: `apps/api/src/rooms/rooms.controller.ts`
- Modify: `apps/api/src/events/events.controller.ts`
- Modify: `apps/api/src/invites/invites.controller.ts`
- Modify: `apps/api/src/invites/invites.service.ts`
- Modify: `apps/api/src/invites/invites.module.ts`

**Interfaces:**
- Consumes: `RequirePermission` from Task 3, `RolesService.assignableRoles`
  from Task 4.
- Produces: nothing new — this is the task where the whole backend builds
  and runs again.

- [ ] **Step 1: Gate `members.controller.ts`**

Add `RequirePermission` to the import from `../authz/decorators`. Add
decorators: `@RequirePermission("members", "read")` on `list`, `detail`,
`listRelationships`; `@RequirePermission("members", "create")` on `create`,
`importMany`, `createRelationship`; `@RequirePermission("members",
"update")` on `update`, `removeRelationship`. Example for the top of the
class:

```ts
import { CurrentAuth, RequirePermission } from "../authz/decorators"
...
  @RequirePermission("members", "read")
  @Get()
  list(...): Promise<MemberResponse[]> { ... }

  @RequirePermission("members", "create")
  @Post()
  create(...): Promise<MemberResponse> { ... }

  @RequirePermission("members", "create")
  @Post("import")
  importMany(...): Promise<MemberImportResult> { ... }

  @RequirePermission("members", "read")
  @Get(":id")
  detail(...): Promise<MemberDetailResponse> { ... }

  @RequirePermission("members", "update")
  @Patch(":id")
  update(...): Promise<MemberResponse> { ... }

  @RequirePermission("members", "read")
  @Get(":id/relationships")
  listRelationships(...): Promise<MemberRelationshipResponse[]> { ... }

  @RequirePermission("members", "update")
  @Post(":id/relationships")
  createRelationship(...): Promise<MemberRelationshipResponse> { ... }

  @RequirePermission("members", "update")
  @Delete(":id/relationships/:relatedMemberId/:relationType")
  removeRelationship(...): Promise<void> { ... }
```

(Keep every method body and signature exactly as they are today — only add
the decorator lines and the import.)

- [ ] **Step 2: Gate `groups.controller.ts`**

Import `RequirePermission` from `../authz/decorators` (alongside the
existing `CurrentAuth` import). Add exactly these decorator lines,
immediately above each existing handler, with every method body/signature
left unchanged:

```ts
  @RequirePermission("groups", "read")
  @Get()
  list(...

  @RequirePermission("groups", "create")
  @Post()
  create(...

  @RequirePermission("groups", "read")
  @Get("attendance-heatmap")
  attendanceHeatmap(...

  @RequirePermission("groups", "read")
  @Get(":id")
  detail(...

  @RequirePermission("groups", "update")
  @Patch(":id")
  update(...

  @RequirePermission("groups", "update")
  @Post(":id/sessions")
  logSession(...
```

- [ ] **Step 3: Gate `households.controller.ts`**

Import `RequirePermission` from `../authz/decorators`. Add exactly these
decorator lines, immediately above each existing handler:

```ts
  @RequirePermission("households", "read")
  @Get()
  list(...

  @RequirePermission("households", "read")
  @Get("count")
  count(...

  @RequirePermission("households", "create")
  @Post()
  create(...

  @RequirePermission("households", "read")
  @Get(":id")
  detail(...

  @RequirePermission("households", "update")
  @Patch(":id")
  update(...

  @RequirePermission("households", "update")
  @Post(":id/members/:memberId")
  addMember(...

  @RequirePermission("households", "update")
  @Delete(":id/members/:memberId")
  removeMember(...
```

- [ ] **Step 4: Gate `tags.controller.ts`**

Replace the `Roles` import with `RequirePermission`. Add
`@RequirePermission("tags", "read")` on `list` (currently has no decorator
at all). Replace each `@Roles("admin")` with the matching permission:
`create` → `@RequirePermission("tags", "create")`, `update` →
`@RequirePermission("tags", "update")`, `remove` → `@RequirePermission
("tags", "delete")`.

- [ ] **Step 5: Gate `rooms.controller.ts`**

Replace the `Roles` import with `RequirePermission`. Add
`@RequirePermission("rooms", "read")` on `list` and `detail` (currently no
decorator). Replace each `@Roles("admin")`: `create` → `@RequirePermission
("rooms", "create")`, `update` → `@RequirePermission("rooms", "update")`,
`remove` → `@RequirePermission("rooms", "delete")`.

- [ ] **Step 6: Gate `events.controller.ts`**

Import `RequirePermission` (this controller currently has no `Roles`
import at all — fully ungated). Add: `@RequirePermission("events", "read")`
on `list`, `detail`; `@RequirePermission("events", "create")` on `create`;
`@RequirePermission("events", "update")` on `update`; `@RequirePermission
("events", "delete")` on `remove`.

- [ ] **Step 7: Gate `invites.controller.ts`**

Replace the `Roles` import with `RequirePermission` (keep `Public`).
Replace `@Roles("admin")`: `list` → `@RequirePermission("invites",
"read")`, `create` → `@RequirePermission("invites", "create")`, `revoke` →
`@RequirePermission("invites", "delete")`. Leave `preview`'s `@Public()`
untouched.

- [ ] **Step 8: Rewrite `invites.service.ts`**

Replace the whole file:

```ts
import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import type {
  InviteCreateInput,
  InvitePreviewResponse,
  InviteResponse,
} from "@gembala/shared"
import { createHash, randomBytes } from "node:crypto"
import { and, eq, inArray } from "drizzle-orm"
import { InjectDb, type Db } from "../db/drizzle.module"
import { invites, inviteRoles, inviteScopeTags, organizations, roles, tags } from "../db/schema"
import type { AuthContext } from "../authz/auth-context"
import { MailService } from "../mail/mail.service"
import { TagsService } from "../tags/tags.service"
import { RolesService } from "../roles/roles.service"

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex")

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

@Injectable()
export class InvitesService {
  constructor(
    @InjectDb() private readonly db: Db,
    private readonly tags: TagsService,
    private readonly roles: RolesService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  private status(row: {
    acceptedAt: Date | null
    revokedAt: Date | null
    expiresAt: Date
  }): InviteResponse["status"] {
    if (row.revokedAt) return "revoked"
    if (row.acceptedAt) return "accepted"
    if (row.expiresAt < new Date()) return "expired"
    return "pending"
  }

  async list(auth: AuthContext): Promise<InviteResponse[]> {
    const rows = await this.db.select().from(invites).where(eq(invites.orgId, auth.orgId))
    if (rows.length === 0) return []
    const inviteIds = rows.map((r) => r.id)

    const scopeRows = await this.db
      .select({ inviteId: inviteScopeTags.inviteId, name: tags.name })
      .from(inviteScopeTags)
      .innerJoin(tags, eq(tags.id, inviteScopeTags.tagId))
      .where(inArray(inviteScopeTags.inviteId, inviteIds))
    const scopeByInvite = new Map<string, string[]>()
    for (const r of scopeRows) {
      const list = scopeByInvite.get(r.inviteId) ?? []
      list.push(r.name)
      scopeByInvite.set(r.inviteId, list)
    }

    const roleRows = await this.db
      .select({ inviteId: inviteRoles.inviteId, id: roles.id, name: roles.name })
      .from(inviteRoles)
      .innerJoin(roles, eq(roles.id, inviteRoles.roleId))
      .where(inArray(inviteRoles.inviteId, inviteIds))
    const rolesByInvite = new Map<string, { id: string; name: string }[]>()
    for (const r of roleRows) {
      const list = rolesByInvite.get(r.inviteId) ?? []
      list.push({ id: r.id, name: r.name })
      rolesByInvite.set(r.inviteId, list)
    }

    return rows
      .map((r) => ({
        id: r.id,
        email: r.email,
        roles: rolesByInvite.get(r.id) ?? [],
        scopeTags: scopeByInvite.get(r.id) ?? [],
        status: this.status(r),
        createdAt: r.createdAt.toISOString(),
        expiresAt: r.expiresAt.toISOString(),
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async create(auth: AuthContext, input: InviteCreateInput): Promise<InviteResponse> {
    const tagIdsByName = await this.tags.resolveTagIds(auth.orgId, input.scopeTags)

    const grantable = await this.roles.assignableRoles(auth)
    const grantableIds = new Set(grantable.map((r) => r.id))
    if (!input.roleIds.every((id) => grantableIds.has(id))) {
      throw new ForbiddenException("you can't invite someone with a role you don't have access to grant")
    }
    const invitedRoles = grantable.filter((r) => input.roleIds.includes(r.id))

    const token = randomBytes(32).toString("hex")
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS)

    const created = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(invites)
        .values({
          orgId: auth.orgId,
          email: input.email.toLowerCase(),
          tokenHash: sha256(token),
          invitedBy: auth.userId,
          expiresAt,
        })
        .returning()
      await tx.insert(inviteScopeTags).values(
        input.scopeTags.map((name) => ({ inviteId: row.id, tagId: tagIdsByName.get(name)! })),
      )
      await tx.insert(inviteRoles).values(
        input.roleIds.map((roleId) => ({ inviteId: row.id, roleId })),
      )
      return row
    })

    const webOrigin = this.config.getOrThrow<string>("WEB_ORIGIN")
    await this.mail.sendInvite(created.email, auth.orgName, `${webOrigin}/accept-invite?token=${token}`)

    return {
      id: created.id,
      email: created.email,
      roles: invitedRoles.map((r) => ({ id: r.id, name: r.name })),
      scopeTags: input.scopeTags,
      status: "pending",
      createdAt: created.createdAt.toISOString(),
      expiresAt: created.expiresAt.toISOString(),
    }
  }

  async revoke(auth: AuthContext, id: string): Promise<void> {
    const [row] = await this.db
      .update(invites)
      .set({ revokedAt: new Date() })
      .where(and(eq(invites.id, id), eq(invites.orgId, auth.orgId)))
      .returning({ id: invites.id })
    if (!row) throw new NotFoundException("invite not found")
  }

  // Public: feeds the accept-invite page before the user has an account.
  async preview(token: string): Promise<InvitePreviewResponse> {
    const [row] = await this.db
      .select({
        id: invites.id,
        email: invites.email,
        acceptedAt: invites.acceptedAt,
        revokedAt: invites.revokedAt,
        expiresAt: invites.expiresAt,
        orgName: organizations.name,
      })
      .from(invites)
      .innerJoin(organizations, eq(organizations.id, invites.orgId))
      .where(eq(invites.tokenHash, sha256(token)))
    if (!row || row.revokedAt || row.acceptedAt || row.expiresAt < new Date()) {
      throw new NotFoundException("invalid or expired invite")
    }

    const scopeRows = await this.db
      .select({ name: tags.name })
      .from(inviteScopeTags)
      .innerJoin(tags, eq(tags.id, inviteScopeTags.tagId))
      .where(eq(inviteScopeTags.inviteId, row.id))

    const roleRows = await this.db
      .select({ id: roles.id, name: roles.name })
      .from(inviteRoles)
      .innerJoin(roles, eq(roles.id, inviteRoles.roleId))
      .where(eq(inviteRoles.inviteId, row.id))

    return {
      orgName: row.orgName,
      email: row.email,
      roles: roleRows,
      scopeTags: scopeRows.map((r) => r.name),
    }
  }
}
```

- [ ] **Step 9: Import `RolesModule` into `InvitesModule`**

In `apps/api/src/invites/invites.module.ts`, add the import and add
`RolesModule` to `imports`:

```ts
import { Module } from "@nestjs/common"
import { TagsModule } from "../tags/tags.module"
import { RolesModule } from "../roles/roles.module"
import { InvitesController } from "./invites.controller"
import { InvitesService } from "./invites.service"

@Module({
  imports: [TagsModule, RolesModule],
  controllers: [InvitesController],
  providers: [InvitesService],
})
export class InvitesModule {}
```

- [ ] **Step 10: Build — this is the checkpoint**

```bash
pnpm --filter @gembala/api build
```

Expected: succeeds with no TypeScript errors. If it doesn't, the error will
point at a stale `role`/`roleLabel`/`Roles` reference — grep for it
(`grep -rn "roleLabel\|@Roles(\|MembershipRole" apps/api/src`) and finish
migrating that spot; every occurrence should already be gone after Tasks
2-5.

- [ ] **Step 11: Start the API and run through the RBAC scenarios**

```bash
pnpm --filter @gembala/api dev
```

In another terminal, register a fresh org (this exercises the Task 3
`register()` seeding):

```bash
curl -s -X POST http://localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Test Admin","email":"admin@test.dev","password":"password123","organizationName":"Test Org"}' | tee /tmp/admin.json
ADMIN_TOKEN=$(node -pe 'JSON.parse(require("fs").readFileSync("/tmp/admin.json")).token')
```

Confirm `/auth/me` shows `isSystemAdmin: true`, `roles: [{ name: "Admin" }]`,
empty `permissions`:

```bash
curl -s http://localhost:3000/api/auth/me -H "Authorization: Bearer $ADMIN_TOKEN"
```

List roles and confirm both "Admin" (`isSystemAdmin: true`) and "Leader"
exist for the new org:

```bash
curl -s http://localhost:3000/api/roles -H "Authorization: Bearer $ADMIN_TOKEN"
```

Create a custom role with only `members:read`, capture its id as
`$ROLE_ID`, then create an invite granting it — **this must succeed** (Admin
can grant anything):

```bash
curl -s -X POST http://localhost:3000/api/roles -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Read Only","description":"","permissions":["members:read"]}'
```

Review Focus #2 — privilege escalation: find the seeded org's Admin role id
via `GET /roles`, then attempt to create an invite as the Admin granting
that Admin role to someone new — this should succeed (admins can grant
anything) — but confirm `GET /roles/assignable` as a **non**-admin excludes
it. To test the non-admin side: accept an invite for the "Read Only" role
above (use the emailed/logged token — check the API console output for the
invite link, or query `invites.tokenHash` — simplest is to have the invite
create step print the link via the mail service's dev-console logger),
register that leader, then as that leader's token call `GET
/roles/assignable` and confirm the Admin role is **not** in the list, and
`POST /invites` with the Admin role id in `roleIds` returns 403.

Review Focus #3 — zero-role membership: as the admin, call `PUT
/team/:membershipId/roles` with `{"roleIds": []}` for the "Read Only"
leader, then call `GET /auth/me` with that leader's token — expect 200
with `roles: []`, `permissions: []`, not a 500.

Review Focus #4 — cascading role delete: with that leader still assigned
the "Read Only" role, `DELETE /roles/:id` for it as admin, then `GET
/auth/me` as that leader again — expect 200 with `roles: []`, not an error.

Review Focus #5 (guard behavior) — as the "Read Only" leader (only has
`members:read`), `GET /roles` should 403 (system-admin only), and `POST
/members` should 403 (`members:create` missing) while `GET /members`
succeeds.

- [ ] **Step 12: Commit**

```bash
git add apps/api/src/members/members.controller.ts apps/api/src/groups/groups.controller.ts \
  apps/api/src/households/households.controller.ts apps/api/src/tags/tags.controller.ts \
  apps/api/src/rooms/rooms.controller.ts apps/api/src/events/events.controller.ts \
  apps/api/src/invites
git commit -m "feat(api): enforce per-resource permissions on every controller"
```

---

### Task 6: Frontend auth core — permissions, isSystemAdmin, route guards

**Files:**
- Modify: `apps/web/src/lib/auth.tsx`
- Modify: `apps/web/src/components/app-sidebar.tsx`
- Modify: `apps/web/src/pages/tags.tsx`
- Modify: `apps/web/src/pages/rooms.tsx`

**Interfaces:**
- Consumes: `MeResponse.roles/isSystemAdmin/permissions` from Task 1.
- Produces: `useAuth()` gains `isSystemAdmin`, `permissions: Set<string>`,
  `hasPermission(resource, action)`; new `RequirePermission` and
  `RequireSystemAdmin` components — Task 8 wraps routes with these.

- [ ] **Step 1: Rewrite `auth.tsx`**

Replace the whole file:

```tsx
import { createContext, useCallback, useContext, useMemo, useState } from "react"
import { Navigate, useLocation } from "react-router-dom"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  AcceptInviteInput,
  AuthResponse,
  LoginInput,
  MeResponse,
  PermissionAction,
  PermissionResource,
  RegisterInput,
} from "@gembala/shared"
import { permissionKey } from "@gembala/shared"
import { apiFetch, clearToken, getToken, setToken } from "./api"

type AuthContextValue = {
  me: MeResponse | null
  isLoading: boolean
  isSystemAdmin: boolean
  permissions: Set<string>
  hasPermission: (resource: PermissionResource, action: PermissionAction) => boolean
  login: (input: LoginInput) => Promise<void>
  register: (input: RegisterInput) => Promise<void>
  acceptInvite: (input: AcceptInviteInput) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const [hasToken, setHasToken] = useState(() => Boolean(getToken()))

  const { data: me = null, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<MeResponse>("/auth/me"),
    enabled: hasToken,
    staleTime: 60_000,
    retry: false,
  })

  const applyAuth = useCallback(
    (res: AuthResponse) => {
      setToken(res.token)
      setHasToken(true)
      queryClient.setQueryData(["me"], res.me)
      // fresh identity = fresh scope: drop everything cached
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== "me" })
    },
    [queryClient],
  )

  const login = useCallback(
    async (input: LoginInput) => {
      applyAuth(await apiFetch<AuthResponse>("/auth/login", { method: "POST", body: input }))
    },
    [applyAuth],
  )

  const register = useCallback(
    async (input: RegisterInput) => {
      applyAuth(await apiFetch<AuthResponse>("/auth/register", { method: "POST", body: input }))
    },
    [applyAuth],
  )

  const acceptInvite = useCallback(
    async (input: AcceptInviteInput) => {
      applyAuth(await apiFetch<AuthResponse>("/auth/accept-invite", { method: "POST", body: input }))
    },
    [applyAuth],
  )

  const logout = useCallback(() => {
    clearToken()
    setHasToken(false)
    queryClient.clear()
  }, [queryClient])

  const permissions = useMemo(() => new Set(me?.permissions ?? []), [me])
  const isSystemAdmin = me?.isSystemAdmin ?? false
  const hasPermission = useCallback(
    (resource: PermissionResource, action: PermissionAction) =>
      isSystemAdmin || permissions.has(permissionKey(resource, action)),
    [isSystemAdmin, permissions],
  )

  return (
    <AuthContext.Provider
      value={{
        me,
        isLoading: hasToken && isLoading,
        isSystemAdmin,
        permissions,
        hasPermission,
        login,
        register,
        acceptInvite,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { me, isLoading } = useAuth()
  const location = useLocation()

  if (!getToken()) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  if (isLoading) {
    return (
      <div className="text-muted-foreground flex h-dvh items-center justify-center text-sm">
        Loading…
      </div>
    )
  }
  if (!me) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  return <>{children}</>
}

function Forbidden() {
  return (
    <div className="text-muted-foreground flex h-64 items-center justify-center text-sm">
      You don't have access to this page.
    </div>
  )
}

export function RequirePermission({
  resource,
  action,
  children,
}: {
  resource: PermissionResource
  action: PermissionAction
  children: React.ReactNode
}) {
  const { hasPermission } = useAuth()
  return hasPermission(resource, action) ? <>{children}</> : <Forbidden />
}

export function RequireSystemAdmin({ children }: { children: React.ReactNode }) {
  const { isSystemAdmin } = useAuth()
  return isSystemAdmin ? <>{children}</> : <Forbidden />
}
```

- [ ] **Step 2: Wire `app-sidebar.tsx` off permissions instead of `isAdmin`**

Replace:

```tsx
const adminNav: NavItem[] = [{ title: "Invites", to: "/settings/invites", icon: MailPlus }]
```

with:

```tsx
const adminNav: NavItem[] = [
  { title: "Invites", to: "/settings/invites", icon: MailPlus },
  { title: "Team", to: "/settings/team", icon: Users2 },
  { title: "Roles", to: "/settings/roles", icon: ShieldCheck },
]
```

(add `Users2, ShieldCheck` to the `lucide-react` import at the top)

Replace:

```tsx
  const { me, isAdmin } = useAuth()
  const manageItems = isAdmin ? [...nav, ...adminNav] : nav
```

with:

```tsx
  const { me, isSystemAdmin, hasPermission } = useAuth()
  const visibleAdminNav = adminNav.filter((item) => {
    if (item.to === "/settings/invites") return hasPermission("invites", "read")
    return isSystemAdmin // Team and Roles stay system-admin-only
  })
  const manageItems = [...nav, ...visibleAdminNav]
```

- [ ] **Step 3: Wire `tags.tsx` off `hasPermission`**

Replace `const { isAdmin } = useAuth()` with:

```tsx
  const { hasPermission } = useAuth()
  const canCreate = hasPermission("tags", "create")
  const canManage = hasPermission("tags", "update") || hasPermission("tags", "delete")
```

Replace every `isAdmin` reference: the `action={isAdmin ? <AddTagDialog .../> : undefined}` on
`PageHeader` uses `canCreate`; the `TagRow` component's `isAdmin` prop
(both its type and the two places it's passed: `<TagRow ... isAdmin={isAdmin} />`
in the forest map, and the recursive `<TagRow key={c.name} node={c} byName={byName} isAdmin={isAdmin} />`)
becomes `canManage` — rename the prop to `canManage` throughout `TagRow`
for clarity (its internal `{isAdmin && (...)}` guard becomes
`{canManage && (...)}`).

- [ ] **Step 4: Wire `rooms.tsx` off `hasPermission`**

Replace `const { isAdmin } = useAuth()` with:

```tsx
  const { hasPermission } = useAuth()
  const canCreate = hasPermission("rooms", "create")
  const canManage = hasPermission("rooms", "update") || hasPermission("rooms", "delete")
```

Replace `action={isAdmin ? <AddRoomDialog /> : undefined}` with
`action={canCreate ? <AddRoomDialog /> : undefined}`. Replace both
`{isAdmin && <TableHead .../>}` and `{isAdmin && (...)}` (the actions
dropdown cell) with `canManage`.

- [ ] **Step 5: Verify — expect the same red build as backend, for a different reason**

`apps/web` won't build yet either: it still imports `@gembala/shared`
types that Task 1 already updated, but `apps/web`'s own `invites.tsx` and
`queries.ts` still reference the old `roleLabel`/`InviteCreateInput` shape
(fixed in Task 9), and `@gembala/shared`'s built output needs refreshing.
Run:

```bash
pnpm --filter @gembala/shared build
```

first (so `apps/web` picks up Task 1's type changes), then read back the 4
files from this task to confirm they're internally consistent. Full
`pnpm --filter @gembala/web build` is the Task 10 checkpoint.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/auth.tsx apps/web/src/components/app-sidebar.tsx \
  apps/web/src/pages/tags.tsx apps/web/src/pages/rooms.tsx
git commit -m "feat(web): add permission-aware auth context and route guards"
```

---

### Task 7: Roles settings page

**Files:**
- Modify: `apps/web/src/lib/queries.ts`
- Create: `apps/web/src/components/role-form-dialog.tsx`
- Create: `apps/web/src/pages/roles.tsx`

**Interfaces:**
- Consumes: `RoleResponse`, `RoleCreateInput`, `RoleUpdateInput`,
  `ALL_PERMISSIONS`, `permissionResourceSchema`, `permissionActionSchema`
  from Task 1; `RequireSystemAdmin` from Task 6.
- Produces: `useRoles`, `useCreateRole`, `useUpdateRole`, `useDeleteRole`
  hooks — Task 8's Team page reuses `useRoles`.

- [ ] **Step 1: Add role query hooks**

In `apps/web/src/lib/queries.ts`, add to the type import list:
`RoleCreateInput, RoleResponse, RoleUpdateInput`. Add these functions
(near the other resource hooks, e.g. after the tag hooks):

```ts
export function useRoles() {
  return useQuery({
    queryKey: ["roles"],
    queryFn: () => apiFetch<RoleResponse[]>("/roles"),
  })
}

export function useCreateRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: RoleCreateInput) =>
      apiFetch<RoleResponse>("/roles", { method: "POST", body: input }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["roles"] }),
  })
}

export function useUpdateRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...input }: RoleUpdateInput & { id: string }) =>
      apiFetch<RoleResponse>(`/roles/${id}`, { method: "PATCH", body: input }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["roles"] }),
  })
}

export function useDeleteRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/roles/${id}`, { method: "DELETE" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["roles"] }),
  })
}
```

- [ ] **Step 2: Create the role create/edit dialog**

Create `apps/web/src/components/role-form-dialog.tsx`:

```tsx
import { useState } from "react"
import { toast } from "sonner"
import { Plus } from "lucide-react"
import { permissionActionSchema, permissionResourceSchema, type RoleResponse } from "@gembala/shared"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { useCreateRole, useUpdateRole } from "@/lib/queries"

const RESOURCES = permissionResourceSchema.options
const ACTIONS = permissionActionSchema.options

export function RoleFormDialog({
  role,
  trigger,
}: {
  role?: RoleResponse
  trigger?: React.ReactNode
}) {
  const createRole = useCreateRole()
  const updateRole = useUpdateRole()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(role?.name ?? "")
  const [description, setDescription] = useState(role?.description ?? "")
  const [perms, setPerms] = useState<Set<string>>(new Set(role?.permissions ?? []))

  const onOpenChange = (v: boolean) => {
    if (v) {
      setName(role?.name ?? "")
      setDescription(role?.description ?? "")
      setPerms(new Set(role?.permissions ?? []))
    }
    setOpen(v)
  }

  const toggle = (key: string) =>
    setPerms((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const save = async () => {
    try {
      const input = { name, description, permissions: [...perms] }
      if (role) {
        await updateRole.mutateAsync({ id: role.id, ...input })
        toast.success(`${name} updated`)
      } else {
        await createRole.mutateAsync(input)
        toast.success(`${name} created`)
      }
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save role")
    }
  }

  const saving = createRole.isPending || updateRole.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="size-4" /> New role
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{role ? "Edit role" : "New role"}</DialogTitle>
          <DialogDescription>
            Pick which actions this role can take on each resource.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="role-name">Name</Label>
            <Input id="role-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="role-description">Description</Label>
            <Textarea
              id="role-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label>Permissions</Label>
            <div className="overflow-hidden rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="p-2 text-left font-medium">Resource</th>
                    {ACTIONS.map((a) => (
                      <th key={a} className="p-2 text-center font-medium capitalize">
                        {a}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {RESOURCES.map((resource) => (
                    <tr key={resource} className="border-t">
                      <td className="p-2 capitalize">{resource}</td>
                      {ACTIONS.map((action) => {
                        const key = `${resource}:${action}`
                        return (
                          <td key={key} className="p-2 text-center">
                            <Checkbox
                              checked={perms.has(key)}
                              onCheckedChange={() => toggle(key)}
                            />
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={save} disabled={!name || saving}>
            {saving ? "Saving…" : role ? "Save changes" : "Create role"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 3: Create the roles page**

Create `apps/web/src/pages/roles.tsx`:

```tsx
import { toast } from "sonner"
import { MoreHorizontal, Pencil, Trash2, ShieldCheck } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PageHeader } from "@/components/page-header"
import { RoleFormDialog } from "@/components/role-form-dialog"
import { useDeleteRole, useRoles } from "@/lib/queries"

export function RolesPage() {
  const { data: roles = [], isLoading } = useRoles()
  const deleteRole = useDeleteRole()

  const remove = async (id: string, name: string) => {
    try {
      await deleteRole.mutateAsync(id)
      toast(`${name} removed`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete role")
    }
  }

  return (
    <div>
      <PageHeader
        title="Roles"
        subtitle="Define what each role can do. Assign roles to people from the Team page."
        action={<RoleFormDialog />}
      />

      <Card className="py-0">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead>Members</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-1.5">
                      {r.isSystemAdmin && <ShieldCheck className="text-primary size-4" />}
                      {r.name}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-xs truncate">
                    {r.description || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.isSystemAdmin ? "All" : r.permissions.length}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{r.memberCount}</Badge>
                  </TableCell>
                  <TableCell>
                    {!r.isSystemAdmin && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-7">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <RoleFormDialog
                            role={r}
                            trigger={
                              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                <Pencil className="size-4" /> Edit role
                              </DropdownMenuItem>
                            }
                          />
                          <DropdownMenuItem variant="destructive" onClick={() => remove(r.id, r.name)}>
                            <Trash2 className="size-4" /> Delete role
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!isLoading && roles.length === 0 && (
            <div className="text-muted-foreground py-12 text-center">No roles yet.</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 4: Verify**

Read back all three files to confirm imports/types line up with Task 1's
`RoleResponse`/`RoleCreateInput`/`RoleUpdateInput` shapes. Full build
happens in Task 10.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/queries.ts apps/web/src/components/role-form-dialog.tsx apps/web/src/pages/roles.tsx
git commit -m "feat(web): add roles management page"
```

---

### Task 8: Team settings page + route wiring

**Files:**
- Modify: `apps/web/src/lib/queries.ts`
- Create: `apps/web/src/components/team-roles-dialog.tsx`
- Create: `apps/web/src/pages/team.tsx`
- Modify: `apps/web/src/App.tsx`

**Interfaces:**
- Consumes: `TeamMemberResponse`, `MembershipRoleAssignInput` from Task 1;
  `useRoles` from Task 7; `RequireSystemAdmin`, `RequirePermission` from
  Task 6.
- Produces: `/settings/team` and `/settings/roles` routes, both reachable
  only by system admins.

- [ ] **Step 1: Add team query hooks**

In `apps/web/src/lib/queries.ts`, add `TeamMemberResponse` to the type
import list. Add:

```ts
export function useTeam() {
  return useQuery({
    queryKey: ["team"],
    queryFn: () => apiFetch<TeamMemberResponse[]>("/team"),
  })
}

export function useUpdateMembershipRoles() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ membershipId, roleIds }: { membershipId: string; roleIds: string[] }) =>
      apiFetch<void>(`/team/${membershipId}/roles`, { method: "PUT", body: { roleIds } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["team"] }),
  })
}
```

- [ ] **Step 2: Create the edit-roles dialog**

Create `apps/web/src/components/team-roles-dialog.tsx`:

```tsx
import { useState } from "react"
import { toast } from "sonner"
import type { TeamMemberResponse } from "@gembala/shared"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { useRoles, useUpdateMembershipRoles } from "@/lib/queries"

export function TeamRolesDialog({
  member,
  open,
  onOpenChange,
}: {
  member: TeamMemberResponse
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const { data: roles = [] } = useRoles()
  const updateRoles = useUpdateMembershipRoles()
  const [picked, setPicked] = useState<Set<string>>(new Set(member.roles.map((r) => r.id)))

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const save = async () => {
    try {
      await updateRoles.mutateAsync({ membershipId: member.membershipId, roleIds: [...picked] })
      toast.success(`${member.user.name}'s roles updated`)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update roles")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit {member.user.name}'s roles</DialogTitle>
          <DialogDescription>{member.user.email}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          {roles.map((r) => (
            <label key={r.id} className="flex cursor-pointer items-center gap-2">
              <Checkbox checked={picked.has(r.id)} onCheckedChange={() => toggle(r.id)} />
              <span className="text-sm">{r.name}</span>
            </label>
          ))}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={save} disabled={updateRoles.isPending}>
            {updateRoles.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 3: Create the team page**

Create `apps/web/src/pages/team.tsx`:

```tsx
import { useState } from "react"
import { Pencil } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PageHeader } from "@/components/page-header"
import { TeamRolesDialog } from "@/components/team-roles-dialog"
import { useTeam } from "@/lib/queries"
import type { TeamMemberResponse } from "@gembala/shared"

export function TeamPage() {
  const { data: team = [], isLoading } = useTeam()
  const [editing, setEditing] = useState<TeamMemberResponse | null>(null)

  return (
    <div>
      <PageHeader title="Team" subtitle="Everyone with access to this organization, and their roles." />

      <Card className="py-0">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {team.map((m) => (
                <TableRow key={m.membershipId}>
                  <TableCell className="font-medium">{m.user.name}</TableCell>
                  <TableCell className="text-muted-foreground">{m.user.email}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {m.roles.map((r) => (
                        <Badge key={r.id} variant="secondary">
                          {r.name}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {m.scopeTags === null ? "Full access" : m.scopeTags.join(", ") || "None"}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="size-7" onClick={() => setEditing(m)}>
                      <Pencil className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!isLoading && team.length === 0 && (
            <div className="text-muted-foreground py-12 text-center">No team members yet.</div>
          )}
        </CardContent>
      </Card>

      {editing && (
        <TeamRolesDialog
          member={editing}
          open={Boolean(editing)}
          onOpenChange={(v) => !v && setEditing(null)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Wire routes in `App.tsx`**

Add imports:

```tsx
import { RolesPage } from "@/pages/roles"
import { TeamPage } from "@/pages/team"
import { RequirePermission, RequireSystemAdmin } from "@/lib/auth"
```

Replace:

```tsx
          <Route path="/settings/invites" element={<InvitesPage />} />
```

with:

```tsx
          <Route
            path="/settings/invites"
            element={
              <RequirePermission resource="invites" action="read">
                <InvitesPage />
              </RequirePermission>
            }
          />
          <Route
            path="/settings/team"
            element={
              <RequireSystemAdmin>
                <TeamPage />
              </RequireSystemAdmin>
            }
          />
          <Route
            path="/settings/roles"
            element={
              <RequireSystemAdmin>
                <RolesPage />
              </RequireSystemAdmin>
            }
          />
```

- [ ] **Step 5: Manual check — Review Focus #5**

```bash
pnpm --filter @gembala/shared build
pnpm dev:api &
pnpm dev:web &
```

Log in as the "Read Only" leader from Task 5's verification (only has
`members:read`) and navigate directly to `/settings/roles` in the browser
— expect the "You don't have access to this page." message, not the role
list or a crash. Then log in as the org's Admin and confirm both
`/settings/roles` and `/settings/team` render normally, and both nav items
show up in the sidebar (from Task 6).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/queries.ts apps/web/src/components/team-roles-dialog.tsx \
  apps/web/src/pages/team.tsx apps/web/src/App.tsx
git commit -m "feat(web): add team management page and system-admin route guards"
```

---

### Task 9: Update the invites page for multi-role selection

**Files:**
- Modify: `apps/web/src/lib/queries.ts`
- Modify: `apps/web/src/pages/invites.tsx`

**Interfaces:**
- Consumes: `InviteCreateInput` (now `roleIds`), `InviteResponse` (now
  `roles`) from Task 1; `useAssignableRoles` (new) backed by `GET
  /roles/assignable` from Task 4.

- [ ] **Step 1: Add the assignable-roles hook**

In `apps/web/src/lib/queries.ts`, add:

```ts
export function useAssignableRoles() {
  return useQuery({
    queryKey: ["roles", "assignable"],
    queryFn: () => apiFetch<RoleResponse[]>("/roles/assignable"),
  })
}
```

(`RoleResponse` is already imported from Task 7's Step 1.)

- [ ] **Step 2: Update the invite dialog**

In `apps/web/src/pages/invites.tsx`, replace the `roleLabel` text input
with a role multi-select. Replace:

```tsx
import { useCreateInvite, useInvites, useRevokeInvite, useTags } from "@/lib/queries"
```

with:

```tsx
import { useAssignableRoles, useCreateInvite, useInvites, useRevokeInvite, useTags } from "@/lib/queries"
```

Replace the `InviteDialog` component's state and role field:

```tsx
function InviteDialog() {
  const { data: tags = [] } = useTags()
  const { data: assignableRoles = [] } = useAssignableRoles()
  const createInvite = useCreateInvite()
  const [email, setEmail] = useState("")
  const [pickedRoles, setPickedRoles] = useState<string[]>([])
  const [picked, setPicked] = useState<string[]>([])
  const [open, setOpen] = useState(false)

  const toggle = (t: string) =>
    setPicked((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]))
  const toggleRole = (id: string) =>
    setPickedRoles((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  const save = async () => {
    try {
      await createInvite.mutateAsync({ email, roleIds: pickedRoles, scopeTags: picked })
      toast.success(`Invite sent to ${email}`, {
        description: "The accept link was emailed (check the API console in dev).",
      })
      setEmail("")
      setPickedRoles([])
      setPicked([])
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create invite")
    }
  }
```

Replace the "Role label" `<Input>` field block with:

```tsx
          <div className="grid gap-2">
            <Label>Roles</Label>
            <div className="space-y-1.5 rounded-md border p-3">
              {assignableRoles.map((r) => (
                <label key={r.id} className="flex cursor-pointer items-center gap-2">
                  <Checkbox
                    checked={pickedRoles.includes(r.id)}
                    onCheckedChange={() => toggleRole(r.id)}
                  />
                  <span className="text-sm">{r.name}</span>
                </label>
              ))}
            </div>
          </div>
```

(add `import { Checkbox } from "@/components/ui/checkbox"` to the top, and
remove the now-unused `roleLabel` state and its `<Input>`/`<Label>` block)

Update the save button's disabled condition:

```tsx
          <Button
            onClick={save}
            disabled={!email || pickedRoles.length === 0 || picked.length === 0 || createInvite.isPending}
          >
```

- [ ] **Step 3: Update the invites table to show role chips**

Replace `<TableCell>{inv.roleLabel}</TableCell>` with:

```tsx
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {inv.roles.map((r) => (
                      <Badge key={r.id} variant="secondary">
                        {r.name}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
```

- [ ] **Step 4: Verify**

Read back `invites.tsx` in full to confirm no remaining `roleLabel`
reference and that `Checkbox`/`Badge` imports are present. Full build
happens in Task 10.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/queries.ts apps/web/src/pages/invites.tsx
git commit -m "feat(web): select roles instead of a free-text label when inviting"
```

---

### Task 10: Frontend build checkpoint and full manual walkthrough

**Files:** none (verification only)

- [ ] **Step 1: Build**

```bash
pnpm --filter @gembala/shared build
pnpm --filter @gembala/web build
```

Expected: both succeed with no TypeScript errors. If `apps/web` fails,
grep for the stale reference it points at (`grep -rn "isAdmin\b\|roleLabel"
apps/web/src`) — every occurrence should already be gone after Tasks 6-9.

- [ ] **Step 2: Full manual walkthrough**

```bash
docker compose up -d
pnpm --filter @gembala/api db:migrate
pnpm dev:api &
pnpm dev:web &
```

Walk through, in the browser:

1. Register a new org. Confirm you land on `/dashboard`, and the sidebar
   shows Invites, Team, and Roles under "Manage" (you're the system admin).
2. Go to `/settings/roles`, create a role "Group Leader" with
   `groups:read/create/update` and `members:read` checked.
3. Go to `/settings/invites`, invite a second email with the "Group
   Leader" role and a scope tag. Grab the invite link from the API dev
   console output.
4. Open the invite link in an incognito window, accept it, log in as that
   new user.
5. Confirm: sidebar has no Invites/Team/Roles links; `/members` shows the
   "New member" button (has `members:create`... wait, "Group Leader" only
   has `members:read` — confirm the "New member" button is **absent** on
   `/members` for this user, and present when logged back in as the
   admin); `/groups` shows "New group" (has `groups:create`).
6. As this user, try navigating directly to `/settings/roles` — confirm
   the "You don't have access to this page." message appears.
7. Back as the admin, go to `/settings/team`, find the new user, open
   "Edit roles", uncheck "Group Leader", save. Refresh as that user (or
   re-login) — confirm they now see no create buttons anywhere and
   `/members`/`/groups` show read-only lists.

- [ ] **Step 3: Report results**

No commit for this task — if every step in Step 2 matched the expected
behavior, the plan is complete. If anything didn't match, note which step
and go fix the responsible task before considering the branch done.
