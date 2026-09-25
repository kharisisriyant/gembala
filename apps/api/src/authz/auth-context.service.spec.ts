import { AuthContextService } from "./auth-context.service"
import type { AuthContextRepository } from "./auth-context.repository"

function makeRepo(): jest.Mocked<AuthContextRepository> {
  return {
    findUserMembershipOrg: jest.fn(),
    rolesForMembership: jest.fn(),
    permissionsForRoleIds: jest.fn(),
    scopeTagNamesForMembership: jest.fn(),
  } as unknown as jest.Mocked<AuthContextRepository>
}

const baseRow = {
  userId: "u1",
  userName: "A",
  userEmail: "a@x.com",
  membershipId: "m1",
  orgId: "org-1",
  orgName: "Org",
}

describe("AuthContextService", () => {
  let repo: jest.Mocked<AuthContextRepository>
  let service: AuthContextService

  beforeEach(() => {
    repo = makeRepo()
    service = new AuthContextService(repo)
  })

  it("returns null for an unknown user", async () => {
    repo.findUserMembershipOrg.mockResolvedValue(undefined as any)

    const result = await service.load("missing")

    expect(result).toBeNull()
  })

  it("grants full access (no permission/scope query) for a system admin", async () => {
    repo.findUserMembershipOrg.mockResolvedValue(baseRow as any)
    repo.rolesForMembership.mockResolvedValue([{ id: "r1", name: "Admin", isSystemAdmin: true }] as any)

    const result = await service.load("u1")

    expect(result?.isSystemAdmin).toBe(true)
    expect(result?.scopeTagNames).toBeNull()
    expect(repo.permissionsForRoleIds).not.toHaveBeenCalled()
    expect(repo.scopeTagNamesForMembership).not.toHaveBeenCalled()
  })

  it("loads permissions and scope tags for a non-admin with roles", async () => {
    repo.findUserMembershipOrg.mockResolvedValue(baseRow as any)
    repo.rolesForMembership.mockResolvedValue([{ id: "r1", name: "Leader", isSystemAdmin: false }] as any)
    repo.permissionsForRoleIds.mockResolvedValue([{ permission: "members:read" }] as any)
    repo.scopeTagNamesForMembership.mockResolvedValue([{ name: "youth" }] as any)

    const result = await service.load("u1")

    expect(result?.permissions.has("members:read")).toBe(true)
    expect(result?.scopeTagNames).toEqual(["youth"])
  })

  it("skips the permissions query for a non-admin with zero roles", async () => {
    repo.findUserMembershipOrg.mockResolvedValue(baseRow as any)
    repo.rolesForMembership.mockResolvedValue([])
    repo.scopeTagNamesForMembership.mockResolvedValue([])

    const result = await service.load("u1")

    expect(repo.permissionsForRoleIds).not.toHaveBeenCalled()
    expect(result?.permissions.size).toBe(0)
  })
})
