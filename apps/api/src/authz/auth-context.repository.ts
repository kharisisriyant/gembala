import { Injectable } from "@nestjs/common"
import { eq, inArray } from "drizzle-orm"
import { InjectDb, type Db, type Tx } from "../db/drizzle.module"
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

@Injectable()
export class AuthContextRepository {
  constructor(@InjectDb() private readonly db: Db) {}

  async findUserMembershipOrg(userId: string, tx: Db | Tx = this.db) {
    const [row] = await tx
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
    return row
  }

  async rolesForMembership(membershipId: string, tx: Db | Tx = this.db) {
    return tx
      .select({ id: roles.id, name: roles.name, isSystemAdmin: roles.isSystemAdmin })
      .from(membershipRoles)
      .innerJoin(roles, eq(roles.id, membershipRoles.roleId))
      .where(eq(membershipRoles.membershipId, membershipId))
  }

  async permissionsForRoleIds(roleIds: string[], tx: Db | Tx = this.db) {
    if (roleIds.length === 0) return []
    return tx
      .select({ permission: rolePermissions.permission })
      .from(rolePermissions)
      .where(inArray(rolePermissions.roleId, roleIds))
  }

  async scopeTagNamesForMembership(membershipId: string, tx: Db | Tx = this.db) {
    return tx
      .select({ name: tags.name })
      .from(membershipScopeTags)
      .innerJoin(tags, eq(tags.id, membershipScopeTags.tagId))
      .where(eq(membershipScopeTags.membershipId, membershipId))
  }
}
