import { Injectable } from "@nestjs/common"
import { and, eq, inArray } from "drizzle-orm"
import { InjectDb, type Db, type Tx } from "../db/drizzle.module"
import { invites, inviteRoles, inviteScopeTags, organizations, roles, tags } from "../db/schema"

export type InviteInsert = {
  orgId: string
  email: string
  tokenHash: string
  invitedBy: string
  expiresAt: Date
}

@Injectable()
export class InvitesRepository {
  constructor(@InjectDb() private readonly db: Db) {}

  async listByOrg(orgId: string, tx: Db | Tx = this.db) {
    return tx.select().from(invites).where(eq(invites.orgId, orgId))
  }

  async scopeTagNamesByInviteIds(inviteIds: string[], tx: Db | Tx = this.db) {
    if (inviteIds.length === 0) return []
    return tx
      .select({ inviteId: inviteScopeTags.inviteId, name: tags.name })
      .from(inviteScopeTags)
      .innerJoin(tags, eq(tags.id, inviteScopeTags.tagId))
      .where(inArray(inviteScopeTags.inviteId, inviteIds))
  }

  async rolesByInviteIds(inviteIds: string[], tx: Db | Tx = this.db) {
    if (inviteIds.length === 0) return []
    return tx
      .select({ inviteId: inviteRoles.inviteId, id: roles.id, name: roles.name })
      .from(inviteRoles)
      .innerJoin(roles, eq(roles.id, inviteRoles.roleId))
      .where(inArray(inviteRoles.inviteId, inviteIds))
  }

  async insert(input: InviteInsert, tx: Db | Tx = this.db) {
    const [row] = await tx.insert(invites).values(input).returning()
    return row
  }

  async insertScopeTags(inviteId: string, tagIds: string[], tx: Db | Tx = this.db) {
    if (tagIds.length === 0) return
    await tx.insert(inviteScopeTags).values(tagIds.map((tagId) => ({ inviteId, tagId })))
  }

  async insertRoles(inviteId: string, roleIds: string[], tx: Db | Tx = this.db) {
    if (roleIds.length === 0) return
    await tx.insert(inviteRoles).values(roleIds.map((roleId) => ({ inviteId, roleId })))
  }

  async revoke(orgId: string, id: string, tx: Db | Tx = this.db) {
    const [row] = await tx
      .update(invites)
      .set({ revokedAt: new Date() })
      .where(and(eq(invites.id, id), eq(invites.orgId, orgId)))
      .returning({ id: invites.id })
    return row
  }

  async findByTokenHashWithOrg(tokenHash: string, tx: Db | Tx = this.db) {
    const [row] = await tx
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
      .where(eq(invites.tokenHash, tokenHash))
    return row
  }

  async scopeTagNamesByInviteId(inviteId: string, tx: Db | Tx = this.db) {
    return tx
      .select({ name: tags.name })
      .from(inviteScopeTags)
      .innerJoin(tags, eq(tags.id, inviteScopeTags.tagId))
      .where(eq(inviteScopeTags.inviteId, inviteId))
  }

  async rolesByInviteId(inviteId: string, tx: Db | Tx = this.db) {
    return tx
      .select({ id: roles.id, name: roles.name })
      .from(inviteRoles)
      .innerJoin(roles, eq(roles.id, inviteRoles.roleId))
      .where(eq(inviteRoles.inviteId, inviteId))
  }
}
