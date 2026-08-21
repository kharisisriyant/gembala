import { Injectable } from "@nestjs/common"
import { eq } from "drizzle-orm"
import { InjectDb, type Db } from "../db/drizzle.module"
import { membershipScopeTags, organizations, orgMemberships, tags, users } from "../db/schema"
import type { AuthContext } from "./auth-context"

@Injectable()
export class AuthContextService {
  constructor(@InjectDb() private readonly db: Db) {}

  // Role and scope are read fresh from the DB every call (never cached in a
  // token), so permission changes take effect immediately. Shared by
  // JwtAuthGuard (keyed off a verified JWT's subject) and TelegramService
  // (keyed off a linked Telegram chat's userId — no JWT involved at all).
  async load(userId: string): Promise<AuthContext | null> {
    const rows = await this.db
      .select({
        userId: users.id,
        userName: users.name,
        userEmail: users.email,
        membershipId: orgMemberships.id,
        role: orgMemberships.role,
        roleLabel: orgMemberships.roleLabel,
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

    let scopeTagNames: string[] | null = null
    if (row.role !== "admin") {
      const scopeRows = await this.db
        .select({ name: tags.name })
        .from(membershipScopeTags)
        .innerJoin(tags, eq(tags.id, membershipScopeTags.tagId))
        .where(eq(membershipScopeTags.membershipId, row.membershipId))
      scopeTagNames = scopeRows.map((r) => r.name)
    }

    return { ...row, scopeTagNames }
  }
}
