import { Injectable } from "@nestjs/common"
import type { AuthContext } from "./auth-context"
import { AuthContextRepository } from "./auth-context.repository"

@Injectable()
export class AuthContextService {
  constructor(private readonly authContext: AuthContextRepository) {}

  // Role, permission, and scope are read fresh from the DB every call
  // (never cached in a token), so permission changes take effect
  // immediately. Shared by JwtAuthGuard (keyed off a verified JWT's
  // subject) and TelegramService (keyed off a linked Telegram chat's
  // userId — no JWT involved at all).
  async load(userId: string): Promise<AuthContext | null> {
    const row = await this.authContext.findUserMembershipOrg(userId)
    if (!row) return null

    const roleRows = await this.authContext.rolesForMembership(row.membershipId)

    const isSystemAdmin = roleRows.some((r) => r.isSystemAdmin)

    let permissions = new Set<string>()
    if (!isSystemAdmin && roleRows.length > 0) {
      const permRows = await this.authContext.permissionsForRoleIds(roleRows.map((r) => r.id))
      permissions = new Set(permRows.map((r) => r.permission))
    }

    let scopeTagNames: string[] | null = null
    if (!isSystemAdmin) {
      const scopeRows = await this.authContext.scopeTagNamesForMembership(row.membershipId)
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
