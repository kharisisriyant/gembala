import { Injectable } from "@nestjs/common"
import { and, eq, inArray } from "drizzle-orm"
import { InjectDb, type Db, type Tx } from "../db/drizzle.module"
import { membershipRoles, membershipScopeTags, orgMemberships, rolePermissions, roles, tags, users } from "../db/schema"

export type RoleInsert = { orgId: string; name: string; description: string; isSystemAdmin?: boolean }
export type RolePatch = Partial<{ name: string; description: string }>

@Injectable()
export class RolesRepository {
  constructor(@InjectDb() private readonly db: Db) {}

  async listByOrg(orgId: string, tx: Db | Tx = this.db) {
    return tx.select().from(roles).where(eq(roles.orgId, orgId))
  }

  async permissionsByRoleIds(roleIds: string[], tx: Db | Tx = this.db) {
    if (roleIds.length === 0) return []
    return tx.select().from(rolePermissions).where(inArray(rolePermissions.roleId, roleIds))
  }

  async membershipRolesByRoleIds(roleIds: string[], tx: Db | Tx = this.db) {
    if (roleIds.length === 0) return []
    return tx.select().from(membershipRoles).where(inArray(membershipRoles.roleId, roleIds))
  }

  async findByOrgAndName(orgId: string, name: string, tx: Db | Tx = this.db) {
    const [row] = await tx.select({ id: roles.id }).from(roles).where(and(eq(roles.orgId, orgId), eq(roles.name, name)))
    return row
  }

  async findByIdInOrg(orgId: string, id: string, tx: Db | Tx = this.db) {
    const [row] = await tx.select().from(roles).where(and(eq(roles.id, id), eq(roles.orgId, orgId)))
    return row
  }

  async insert(input: RoleInsert, tx: Db | Tx = this.db) {
    const [row] = await tx.insert(roles).values(input).returning()
    return row
  }

  async insertPermissions(roleId: string, permissions: string[], tx: Db | Tx = this.db) {
    if (permissions.length === 0) return
    await tx.insert(rolePermissions).values(permissions.map((permission) => ({ roleId, permission })))
  }

  async replacePermissions(roleId: string, permissions: string[], tx: Db | Tx = this.db) {
    await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId))
    await this.insertPermissions(roleId, permissions, tx)
  }

  async update(id: string, patch: RolePatch, tx: Db | Tx = this.db) {
    if (Object.keys(patch).length === 0) return
    await tx.update(roles).set(patch).where(eq(roles.id, id))
  }

  async delete(id: string, tx: Db | Tx = this.db) {
    await tx.delete(roles).where(eq(roles.id, id))
  }

  async membershipsWithUserByOrg(orgId: string, tx: Db | Tx = this.db) {
    return tx
      .select({
        membershipId: orgMemberships.id,
        userId: users.id,
        userName: users.name,
        userEmail: users.email,
      })
      .from(orgMemberships)
      .innerJoin(users, eq(users.id, orgMemberships.userId))
      .where(eq(orgMemberships.orgId, orgId))
  }

  async rolesByMembershipIds(membershipIds: string[], tx: Db | Tx = this.db) {
    if (membershipIds.length === 0) return []
    return tx
      .select({
        membershipId: membershipRoles.membershipId,
        roleId: roles.id,
        roleName: roles.name,
        isSystemAdmin: roles.isSystemAdmin,
      })
      .from(membershipRoles)
      .innerJoin(roles, eq(roles.id, membershipRoles.roleId))
      .where(inArray(membershipRoles.membershipId, membershipIds))
  }

  async scopeTagsByMembershipIds(membershipIds: string[], tx: Db | Tx = this.db) {
    if (membershipIds.length === 0) return []
    return tx
      .select({ membershipId: membershipScopeTags.membershipId, name: tags.name })
      .from(membershipScopeTags)
      .innerJoin(tags, eq(tags.id, membershipScopeTags.tagId))
      .where(inArray(membershipScopeTags.membershipId, membershipIds))
  }

  async findMembershipInOrg(orgId: string, membershipId: string, tx: Db | Tx = this.db) {
    const [row] = await tx
      .select({ id: orgMemberships.id })
      .from(orgMemberships)
      .where(and(eq(orgMemberships.id, membershipId), eq(orgMemberships.orgId, orgId)))
    return row
  }

  async membershipRoleIds(membershipId: string, tx: Db | Tx = this.db) {
    return tx.select({ roleId: membershipRoles.roleId }).from(membershipRoles).where(eq(membershipRoles.membershipId, membershipId))
  }

  async membershipsHoldingRoles(orgId: string, roleIds: string[], tx: Db | Tx = this.db) {
    if (roleIds.length === 0) return []
    return tx
      .select({ membershipId: membershipRoles.membershipId })
      .from(membershipRoles)
      .innerJoin(orgMemberships, eq(orgMemberships.id, membershipRoles.membershipId))
      .where(and(eq(orgMemberships.orgId, orgId), inArray(membershipRoles.roleId, roleIds)))
  }

  async replaceMembershipRoles(membershipId: string, roleIds: string[], tx: Db | Tx = this.db) {
    await tx.delete(membershipRoles).where(eq(membershipRoles.membershipId, membershipId))
    if (roleIds.length > 0) {
      await tx.insert(membershipRoles).values(roleIds.map((roleId) => ({ membershipId, roleId })))
    }
  }
}
