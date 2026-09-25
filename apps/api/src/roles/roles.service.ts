import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common"
import type { RoleCreateInput, RoleResponse, RoleUpdateInput, TeamMemberResponse } from "@gembala/shared"
import { InjectDb, type Db } from "../db/drizzle.module"
import type { AuthContext } from "../authz/auth-context"
import { RolesRepository } from "./roles.repository"

@Injectable()
export class RolesService {
  constructor(
    @InjectDb() private readonly db: Db,
    private readonly roles: RolesRepository,
  ) {}

  async list(orgId: string): Promise<RoleResponse[]> {
    const roleRows = await this.roles.listByOrg(orgId)
    if (roleRows.length === 0) return []
    const roleIds = roleRows.map((r) => r.id)

    const permRows = await this.roles.permissionsByRoleIds(roleIds)
    const permsByRole = new Map<string, string[]>()
    for (const p of permRows) {
      const list = permsByRole.get(p.roleId) ?? []
      list.push(p.permission)
      permsByRole.set(p.roleId, list)
    }

    const memberRows = await this.roles.membershipRolesByRoleIds(roleIds)
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
    const existing = await this.roles.findByOrgAndName(orgId, input.name)
    if (existing) throw new ConflictException("a role with this name already exists")

    const created = await this.db.transaction(async (tx) => {
      const role = await this.roles.insert({ orgId, name: input.name, description: input.description }, tx)
      await this.roles.insertPermissions(role.id, input.permissions, tx)
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
    const role = await this.roles.findByIdInOrg(orgId, id)
    if (!role) throw new NotFoundException("role not found")
    if (role.isSystemAdmin) throw new ForbiddenException("the Admin role can't be edited")

    await this.db.transaction(async (tx) => {
      const patch: Partial<{ name: string; description: string }> = {}
      if (input.name !== undefined) patch.name = input.name
      if (input.description !== undefined) patch.description = input.description
      await this.roles.update(id, patch, tx)

      if (input.permissions !== undefined) {
        await this.roles.replacePermissions(id, input.permissions, tx)
      }
    })

    const all = await this.list(orgId)
    return all.find((r) => r.id === id)!
  }

  async remove(orgId: string, id: string): Promise<void> {
    const role = await this.roles.findByIdInOrg(orgId, id)
    if (!role) throw new NotFoundException("role not found")
    if (role.isSystemAdmin) throw new ForbiddenException("the Admin role can't be deleted")
    await this.roles.delete(id)
  }

  async team(orgId: string): Promise<TeamMemberResponse[]> {
    const memberships = await this.roles.membershipsWithUserByOrg(orgId)
    if (memberships.length === 0) return []
    const membershipIds = memberships.map((m) => m.membershipId)

    const roleRows = await this.roles.rolesByMembershipIds(membershipIds)
    const rolesByMembership = new Map<string, { id: string; name: string }[]>()
    const isSystemAdminByMembership = new Map<string, boolean>()
    for (const r of roleRows) {
      const list = rolesByMembership.get(r.membershipId) ?? []
      list.push({ id: r.roleId, name: r.roleName })
      rolesByMembership.set(r.membershipId, list)
      if (r.isSystemAdmin) isSystemAdminByMembership.set(r.membershipId, true)
    }

    const scopeRows = await this.roles.scopeTagsByMembershipIds(membershipIds)
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
    const membership = await this.roles.findMembershipInOrg(auth.orgId, membershipId)
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
      const currentRoleRows = await this.roles.membershipRoleIds(membershipId)
      const currentlyHoldsAdmin = currentRoleRows.some((r) => systemAdminRoleIds.has(r.roleId))
      if (currentlyHoldsAdmin) {
        const adminHolders = await this.roles.membershipsHoldingRoles(auth.orgId, [...systemAdminRoleIds])
        const remaining = new Set(adminHolders.map((r) => r.membershipId))
        remaining.delete(membershipId)
        if (remaining.size === 0) {
          throw new ConflictException("an organization must keep at least one Admin")
        }
      }
    }

    await this.db.transaction((tx) => this.roles.replaceMembershipRoles(membershipId, roleIds, tx))
  }
}
