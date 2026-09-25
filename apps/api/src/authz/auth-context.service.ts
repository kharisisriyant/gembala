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
