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

    // Never let an edit leave the org with zero system admins — there is no
    // in-app recovery path from that (every remaining member is filtered out
    // of assignableRoles for the system-admin role, and /roles + /team both
    // require isSystemAdmin to reach at all).
    const allRoles = await this.list(auth.orgId)
    const systemAdminRoleIds = new Set(allRoles.filter((r) => r.isSystemAdmin).map((r) => r.id))
    const keepsAdmin = roleIds.some((id) => systemAdminRoleIds.has(id))
    if (!keepsAdmin && systemAdminRoleIds.size > 0) {
      const currentRoleRows = await this.db
        .select({ roleId: membershipRoles.roleId })
        .from(membershipRoles)
        .where(eq(membershipRoles.membershipId, membershipId))
      const currentlyHoldsAdmin = currentRoleRows.some((r) => systemAdminRoleIds.has(r.roleId))
      if (currentlyHoldsAdmin) {
        const adminHolders = await this.db
          .select({ membershipId: membershipRoles.membershipId })
          .from(membershipRoles)
          .innerJoin(orgMemberships, eq(orgMemberships.id, membershipRoles.membershipId))
          .where(
            and(
              eq(orgMemberships.orgId, auth.orgId),
              inArray(membershipRoles.roleId, [...systemAdminRoleIds]),
            ),
          )
        const remaining = new Set(adminHolders.map((r) => r.membershipId))
        remaining.delete(membershipId)
        if (remaining.size === 0) {
          throw new ConflictException("an organization must keep at least one Admin")
        }
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
