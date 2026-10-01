import { Injectable } from "@nestjs/common"
import { and, eq, gt, inArray, isNull } from "drizzle-orm"
import { InjectDb, type Db, type Tx } from "../db/drizzle.module"
import {
  invites,
  inviteRoles,
  inviteScopeTags,
  membershipRoles,
  membershipScopeTags,
  organizations,
  organizationInvites,
  orgMemberships,
  passwordResetTokens,
  roles,
  rolePermissions,
  tags,
  users,
  authRefreshTokens,
  authSecurityEvents,
  authSessions,
  authRateLimits,
  journeyStages,
} from "../db/schema"

export type UserInsert = { email: string; name: string; passwordHash: string }
export type RequestMetadata = { ipAddress?: string; userAgent?: string }

@Injectable()
export class AuthRepository {
  constructor(@InjectDb() private readonly db: Db) {}

  async insertOrganizationInvite(input: typeof organizationInvites.$inferInsert) {
    const [row] = await this.db.insert(organizationInvites).values(input).returning()
    return row
  }

  async consumeOrganizationInvite(tokenHash: string, email: string, tx: Db | Tx): Promise<typeof organizationInvites.$inferSelect | undefined> {
    const [row] = await tx.update(organizationInvites).set({ acceptedAt: new Date() }).where(and(
      eq(organizationInvites.tokenHash, tokenHash),
      eq(organizationInvites.email, email),
      isNull(organizationInvites.acceptedAt),
      gt(organizationInvites.expiresAt, new Date()),
    )).returning()
    return row
  }

  async findUserIdByEmail(email: string, tx: Db | Tx = this.db) {
    const [row] = await tx.select({ id: users.id }).from(users).where(eq(users.email, email))
    return row
  }

  async findUserByEmail(email: string, tx: Db | Tx = this.db) {
    const [row] = await tx.select().from(users).where(eq(users.email, email))
    return row
  }

  async insertUser(input: UserInsert, tx: Db | Tx = this.db) {
    const [row] = await tx.insert(users).values(input).returning()
    return row
  }

  async updateUserPasswordHash(userId: string, passwordHash: string, tx: Db | Tx = this.db) {
    await tx.update(users).set({ passwordHash }).where(eq(users.id, userId))
  }

  async createSession(input: {
    id: string; userId: string; csrfTokenHash: string; expiresAt: Date
  } & RequestMetadata, tx: Db | Tx = this.db) {
    const [row] = await tx.insert(authSessions).values(input).returning()
    return row
  }

  async createRefreshToken(input: { id: string; sessionId: string; tokenHash: string; expiresAt: Date }, tx: Db | Tx = this.db) {
    const [row] = await tx.insert(authRefreshTokens).values(input).returning()
    return row
  }

  async findRefreshToken(id: string, tx: Db | Tx = this.db) {
    const [row] = await tx.select({
      refresh: authRefreshTokens,
      session: authSessions,
      user: users,
    }).from(authRefreshTokens)
      .innerJoin(authSessions, eq(authSessions.id, authRefreshTokens.sessionId))
      .innerJoin(users, eq(users.id, authSessions.userId))
      .where(eq(authRefreshTokens.id, id))
    return row
  }

  async findActiveSession(sessionId: string, userId: string, tx: Db | Tx = this.db) {
    const [row] = await tx.select({ session: authSessions, authStatus: users.authStatus })
      .from(authSessions).innerJoin(users, eq(users.id, authSessions.userId))
      .where(and(eq(authSessions.id, sessionId), eq(authSessions.userId, userId), isNull(authSessions.revokedAt), gt(authSessions.expiresAt, new Date())))
    return row
  }

  async rotateRefreshToken(tokenId: string, tx: Db | Tx = this.db) {
    const [row] = await tx.update(authRefreshTokens).set({ rotatedAt: new Date() })
      .where(and(eq(authRefreshTokens.id, tokenId), isNull(authRefreshTokens.rotatedAt), isNull(authRefreshTokens.revokedAt)))
      .returning()
    return row
  }

  async touchSession(id: string, tx: Db | Tx = this.db) {
    await tx.update(authSessions).set({ lastUsedAt: new Date() }).where(eq(authSessions.id, id))
  }

  async updateSessionCsrfTokenHash(id: string, csrfTokenHash: string, tx: Db | Tx = this.db) {
    await tx.update(authSessions).set({ csrfTokenHash }).where(eq(authSessions.id, id))
  }

  async revokeSession(sessionId: string, reason: string, tx: Db | Tx = this.db) {
    const [row] = await tx.update(authSessions).set({ revokedAt: new Date(), revokedReason: reason })
      .where(and(eq(authSessions.id, sessionId), isNull(authSessions.revokedAt))).returning()
    if (row) await tx.update(authRefreshTokens).set({ revokedAt: new Date() })
      .where(and(eq(authRefreshTokens.sessionId, sessionId), isNull(authRefreshTokens.revokedAt)))
    return row
  }

  async revokeSessionsForUser(userId: string, reason: string, tx: Db | Tx = this.db) {
    const rows = await tx.update(authSessions).set({ revokedAt: new Date(), revokedReason: reason })
      .where(and(eq(authSessions.userId, userId), isNull(authSessions.revokedAt))).returning({ id: authSessions.id })
    if (rows.length) await tx.update(authRefreshTokens).set({ revokedAt: new Date() })
      .where(and(isNull(authRefreshTokens.revokedAt), inArray(authRefreshTokens.sessionId, rows.map((row) => row.id))))
    return rows
  }

  async recordSecurityEvent(input: {
    userId?: string; sessionId?: string; type: typeof authSecurityEvents.$inferInsert.type; metadata?: Record<string, unknown>
  } & RequestMetadata, tx: Db | Tx = this.db) {
    await tx.insert(authSecurityEvents).values({ ...input, metadata: input.metadata ?? {} })
  }

  async consumeRateLimit(key: string, limit: number, windowMs: number, tx: Db | Tx = this.db): Promise<boolean> {
    const now = new Date()
    const [row] = await tx.select().from(authRateLimits).where(eq(authRateLimits.key, key))
    if (!row || row.windowStartedAt.getTime() + windowMs <= now.getTime()) {
      if (row) await tx.update(authRateLimits).set({ count: 1, windowStartedAt: now, updatedAt: now }).where(eq(authRateLimits.key, key))
      else await tx.insert(authRateLimits).values({ key, count: 1, windowStartedAt: now, updatedAt: now })
      return true
    }
    if (row.count >= limit) return false
    await tx.update(authRateLimits).set({ count: row.count + 1, updatedAt: now }).where(eq(authRateLimits.key, key))
    return true
  }

  async findUserById(id: string, tx: Db | Tx = this.db) {
    const [row] = await tx.select().from(users).where(eq(users.id, id))
    return row
  }

  async updateUserName(userId: string, name: string, tx: Db | Tx = this.db) {
    await tx.update(users).set({ name }).where(eq(users.id, userId))
  }

  async insertOrganization(name: string, tx: Db | Tx = this.db) {
    const [row] = await tx.insert(organizations).values({ name }).returning()
    return row
  }

  async insertDefaultJourneyStages(orgId: string, tx: Db | Tx = this.db) {
    await tx.insert(journeyStages).values([
      { orgId, name: "Newcomer follow-up", rule: "newcomer_followup", reminderDays: 30, sortOrder: 0 },
    ])
  }

  async insertMembership(orgId: string, userId: string, tx: Db | Tx = this.db) {
    const [row] = await tx.insert(orgMemberships).values({ orgId, userId }).returning()
    return row
  }

  async insertRole(
    input: { orgId: string; name: string; description: string; isSystemAdmin?: boolean },
    tx: Db | Tx = this.db,
  ) {
    const [row] = await tx.insert(roles).values(input).returning()
    return row
  }

  async insertRolePermissions(roleId: string, permissions: string[], tx: Db | Tx = this.db) {
    if (permissions.length === 0) return
    await tx.insert(rolePermissions).values(permissions.map((permission) => ({ roleId, permission })))
  }

  async insertMembershipRole(membershipId: string, roleId: string, tx: Db | Tx = this.db) {
    await tx.insert(membershipRoles).values({ membershipId, roleId })
  }

  async insertMembershipRoles(membershipId: string, roleIds: string[], tx: Db | Tx = this.db) {
    if (roleIds.length === 0) return
    await tx.insert(membershipRoles).values(roleIds.map((roleId) => ({ membershipId, roleId })))
  }

  async insertMembershipScopeTags(membershipId: string, tagIds: string[], tx: Db | Tx = this.db) {
    if (tagIds.length === 0) return
    await tx.insert(membershipScopeTags).values(tagIds.map((tagId) => ({ membershipId, tagId })))
  }

  async insertRootDirectoryTag(orgId: string, tx: Db | Tx = this.db) {
    await tx.insert(tags).values({ orgId, name: "members", description: "Everyone in the church directory" })
  }

  async insertPasswordResetToken(
    input: { userId: string; tokenHash: string; expiresAt: Date },
    tx: Db | Tx = this.db,
  ) {
    await tx.insert(passwordResetTokens).values(input)
  }

  async findValidPasswordResetToken(tokenHash: string, tx: Db | Tx = this.db) {
    const [row] = await tx
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.tokenHash, tokenHash),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, new Date()),
        ),
      )
    return row
  }

  async burnPasswordResetTokensForUser(userId: string, tx: Db | Tx = this.db) {
    await tx
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(and(eq(passwordResetTokens.userId, userId), isNull(passwordResetTokens.usedAt)))
  }

  async findInviteByTokenHash(tokenHash: string, tx: Db | Tx = this.db) {
    const [row] = await tx.select().from(invites).where(eq(invites.tokenHash, tokenHash))
    return row
  }

  async inviteScopeTagIds(inviteId: string, tx: Db | Tx = this.db) {
    return tx.select({ tagId: inviteScopeTags.tagId }).from(inviteScopeTags).where(eq(inviteScopeTags.inviteId, inviteId))
  }

  async inviteRoleIds(inviteId: string, tx: Db | Tx = this.db) {
    return tx.select({ roleId: inviteRoles.roleId }).from(inviteRoles).where(eq(inviteRoles.inviteId, inviteId))
  }

  async markInviteAccepted(inviteId: string, tx: Db | Tx = this.db) {
    await tx.update(invites).set({ acceptedAt: new Date() }).where(eq(invites.id, inviteId))
  }
}
