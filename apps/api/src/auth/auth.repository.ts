import { Injectable } from "@nestjs/common"
import { and, eq, gt, isNull } from "drizzle-orm"
import { InjectDb, type Db, type Tx } from "../db/drizzle.module"
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

export type UserInsert = { email: string; name: string; passwordHash: string }

@Injectable()
export class AuthRepository {
  constructor(@InjectDb() private readonly db: Db) {}

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

  async insertOrganization(name: string, tx: Db | Tx = this.db) {
    const [row] = await tx.insert(organizations).values({ name }).returning()
    return row
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
