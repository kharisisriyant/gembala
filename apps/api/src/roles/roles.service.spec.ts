import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common"
import { RolesService } from "./roles.service"
import type { RolesRepository } from "./roles.repository"
import type { Db } from "../db/drizzle.module"

function makeRepo(): jest.Mocked<RolesRepository> {
  return {
    listByOrg: jest.fn(),
    permissionsByRoleIds: jest.fn(),
    membershipRolesByRoleIds: jest.fn(),
    findByOrgAndName: jest.fn(),
    findByIdInOrg: jest.fn(),
    insert: jest.fn(),
    insertPermissions: jest.fn(),
    replacePermissions: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    membershipsWithUserByOrg: jest.fn(),
    rolesByMembershipIds: jest.fn(),
    scopeTagsByMembershipIds: jest.fn(),
    findMembershipInOrg: jest.fn(),
    membershipRoleIds: jest.fn(),
    membershipsHoldingRoles: jest.fn(),
    replaceMembershipRoles: jest.fn(),
  } as unknown as jest.Mocked<RolesRepository>
}

const orgId = "org-1"
const adminRole = { id: "admin", orgId, name: "Admin", description: "", isSystemAdmin: true }
const leaderRole = { id: "leader", orgId, name: "Leader", description: "", isSystemAdmin: false }

describe("RolesService", () => {
  let repo: jest.Mocked<RolesRepository>
  let db: jest.Mocked<Db>
  let service: RolesService

  beforeEach(() => {
    repo = makeRepo()
    db = { transaction: jest.fn((cb: any) => cb(db)) } as any
    service = new RolesService(db, repo)
  })

  describe("list", () => {
    it("returns [] without extra queries when the org has no roles", async () => {
      repo.listByOrg.mockResolvedValue([])

      const result = await service.list(orgId)

      expect(result).toEqual([])
      expect(repo.permissionsByRoleIds).not.toHaveBeenCalled()
    })

    it("attaches permissions and member counts per role", async () => {
      repo.listByOrg.mockResolvedValue([adminRole, leaderRole] as any)
      repo.permissionsByRoleIds.mockResolvedValue([{ roleId: "leader", permission: "members:read" }] as any)
      repo.membershipRolesByRoleIds.mockResolvedValue([
        { membershipId: "m1", roleId: "leader" },
        { membershipId: "m2", roleId: "leader" },
      ] as any)

      const result = await service.list(orgId)

      const leader = result.find((r) => r.id === "leader")!
      expect(leader.permissions).toEqual(["members:read"])
      expect(leader.memberCount).toBe(2)
    })
  })

  describe("assignableRoles", () => {
    it("excludes system-admin roles for a non-admin caller", async () => {
      repo.listByOrg.mockResolvedValue([adminRole, leaderRole] as any)
      repo.permissionsByRoleIds.mockResolvedValue([])
      repo.membershipRolesByRoleIds.mockResolvedValue([])

      const result = await service.assignableRoles({ orgId, isSystemAdmin: false } as any)

      expect(result.map((r) => r.id)).toEqual(["leader"])
    })

    it("includes system-admin roles for an admin caller", async () => {
      repo.listByOrg.mockResolvedValue([adminRole, leaderRole] as any)
      repo.permissionsByRoleIds.mockResolvedValue([])
      repo.membershipRolesByRoleIds.mockResolvedValue([])

      const result = await service.assignableRoles({ orgId, isSystemAdmin: true } as any)

      expect(result.map((r) => r.id)).toEqual(["admin", "leader"])
    })
  })

  describe("create", () => {
    it("rejects a duplicate role name", async () => {
      repo.findByOrgAndName.mockResolvedValue({ id: "r1" } as any)

      await expect(service.create(orgId, { name: "Leader", permissions: [] } as any)).rejects.toThrow(
        ConflictException,
      )
    })
  })

  describe("update", () => {
    it("404s on unknown role", async () => {
      repo.findByIdInOrg.mockResolvedValue(undefined as any)

      await expect(service.update(orgId, "missing", {} as any)).rejects.toThrow(NotFoundException)
    })

    it("forbids editing the system admin role", async () => {
      repo.findByIdInOrg.mockResolvedValue(adminRole as any)

      await expect(service.update(orgId, "admin", {} as any)).rejects.toThrow(ForbiddenException)
    })
  })

  describe("remove", () => {
    it("forbids deleting the system admin role", async () => {
      repo.findByIdInOrg.mockResolvedValue(adminRole as any)

      await expect(service.remove(orgId, "admin")).rejects.toThrow(ForbiddenException)
      expect(repo.delete).not.toHaveBeenCalled()
    })
  })

  describe("assignRoles — admin lockout guard", () => {
    it("404s when the membership isn't in this org", async () => {
      repo.findMembershipInOrg.mockResolvedValue(undefined as any)

      await expect(service.assignRoles({ orgId } as any, "m1", ["leader"])).rejects.toThrow(
        NotFoundException,
      )
    })

    it("forbids granting a role the caller can't assign", async () => {
      repo.findMembershipInOrg.mockResolvedValue({ id: "m1" } as any)
      repo.listByOrg.mockResolvedValue([adminRole, leaderRole] as any)
      repo.permissionsByRoleIds.mockResolvedValue([])
      repo.membershipRolesByRoleIds.mockResolvedValue([])

      await expect(
        service.assignRoles({ orgId, isSystemAdmin: false } as any, "m1", ["admin"]),
      ).rejects.toThrow(ForbiddenException)
    })

    it("blocks removing the last Admin from the org", async () => {
      repo.findMembershipInOrg.mockResolvedValue({ id: "m1" } as any)
      repo.listByOrg.mockResolvedValue([adminRole, leaderRole] as any)
      repo.permissionsByRoleIds.mockResolvedValue([])
      repo.membershipRolesByRoleIds.mockResolvedValue([])
      repo.membershipRoleIds.mockResolvedValue([{ roleId: "admin" }] as any)
      repo.membershipsHoldingRoles.mockResolvedValue([{ membershipId: "m1" }] as any)

      await expect(
        service.assignRoles({ orgId, isSystemAdmin: true } as any, "m1", ["leader"]),
      ).rejects.toThrow(ConflictException)
      expect(repo.replaceMembershipRoles).not.toHaveBeenCalled()
    })

    it("allows removing Admin from one member when another Admin remains", async () => {
      repo.findMembershipInOrg.mockResolvedValue({ id: "m1" } as any)
      repo.listByOrg.mockResolvedValue([adminRole, leaderRole] as any)
      repo.permissionsByRoleIds.mockResolvedValue([])
      repo.membershipRolesByRoleIds.mockResolvedValue([])
      repo.membershipRoleIds.mockResolvedValue([{ roleId: "admin" }] as any)
      repo.membershipsHoldingRoles.mockResolvedValue([
        { membershipId: "m1" },
        { membershipId: "m2" },
      ] as any)

      await service.assignRoles({ orgId, isSystemAdmin: true } as any, "m1", ["leader"])

      expect(repo.replaceMembershipRoles).toHaveBeenCalledWith("m1", ["leader"], db)
    })

    it("skips the admin-holder check entirely when the new roles keep an Admin", async () => {
      repo.findMembershipInOrg.mockResolvedValue({ id: "m1" } as any)
      repo.listByOrg.mockResolvedValue([adminRole, leaderRole] as any)
      repo.permissionsByRoleIds.mockResolvedValue([])
      repo.membershipRolesByRoleIds.mockResolvedValue([])

      await service.assignRoles({ orgId, isSystemAdmin: true } as any, "m1", ["admin"])

      expect(repo.membershipRoleIds).not.toHaveBeenCalled()
      expect(repo.replaceMembershipRoles).toHaveBeenCalledWith("m1", ["admin"], db)
    })
  })
})
