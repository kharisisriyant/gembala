import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common"
import { HouseholdsService } from "./households.service"
import type { HouseholdsRepository } from "./households.repository"
import type { ScopeService } from "../authz/scope.service"
import type { MembersService } from "../members/members.service"
import type { Db } from "../db/drizzle.module"

function makeHouseholdsRepo(): jest.Mocked<HouseholdsRepository> {
  return {
    listSummariesByOrg: jest.fn(),
    memberHouseholdIdsByOrg: jest.fn(),
    findByIdInOrg: jest.fn(),
    findMemberHouseholdId: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    assignMembersToHousehold: jest.fn(),
    setMemberHousehold: jest.fn(),
    clearPrimaryContactIfMember: jest.fn(),
  } as unknown as jest.Mocked<HouseholdsRepository>
}

const auth = { orgId: "org-1" } as any

describe("HouseholdsService", () => {
  let households: jest.Mocked<HouseholdsRepository>
  let scope: jest.Mocked<ScopeService>
  let members: jest.Mocked<MembersService>
  let db: jest.Mocked<Db>
  let service: HouseholdsService

  beforeEach(() => {
    households = makeHouseholdsRepo()
    scope = { expandedScope: jest.fn(), memberVisible: jest.fn() } as any
    members = { orgMembersWithTags: jest.fn() } as any
    db = { transaction: jest.fn((cb: any) => cb(db)) } as any
    service = new HouseholdsService(db, households, scope, members)
  })

  describe("list", () => {
    it("drops households with no visible members and sorts by name", async () => {
      households.listSummariesByOrg.mockResolvedValue([
        { id: "h1", name: "Zeta", address: "", primaryContactMemberId: null },
        { id: "h2", name: "Alpha", address: "", primaryContactMemberId: null },
        { id: "h3", name: "Empty", address: "", primaryContactMemberId: null },
      ])
      scope.expandedScope.mockResolvedValue({} as any)
      members.orgMembersWithTags.mockResolvedValue([
        { id: "m1", name: "Jo", tags: [] } as any,
        { id: "m2", name: "Al", tags: [] } as any,
      ])
      households.memberHouseholdIdsByOrg.mockResolvedValue([
        { id: "m1", householdId: "h1" },
        { id: "m2", householdId: "h2" },
      ])
      scope.memberVisible.mockReturnValue(true)

      const result = await service.list(auth)

      expect(result.map((h) => h.name)).toEqual(["Alpha", "Zeta"])
    })
  })

  describe("detail", () => {
    it("404s when the household has members but none are visible to scope", async () => {
      households.listSummariesByOrg.mockResolvedValue([
        { id: "h1", name: "Zeta", address: "", primaryContactMemberId: null },
      ])
      scope.expandedScope.mockResolvedValue({} as any)
      members.orgMembersWithTags.mockResolvedValue([{ id: "m1", name: "Jo", tags: [] } as any])
      households.memberHouseholdIdsByOrg.mockResolvedValue([{ id: "m1", householdId: "h1" }])
      scope.memberVisible.mockReturnValue(false)

      await expect(service.detail(auth, "h1")).rejects.toThrow(NotFoundException)
    })

    it("returns a genuinely empty household (no members at all)", async () => {
      households.listSummariesByOrg.mockResolvedValue([
        { id: "h1", name: "Zeta", address: "", primaryContactMemberId: null },
      ])
      scope.expandedScope.mockResolvedValue({} as any)
      members.orgMembersWithTags.mockResolvedValue([])
      households.memberHouseholdIdsByOrg.mockResolvedValue([])

      const result = await service.detail(auth, "h1")

      expect(result.memberCount).toBe(0)
    })
  })

  describe("create", () => {
    it("rejects a primary contact not in memberIds", async () => {
      await expect(
        service.create(auth, {
          name: "Smiths",
          address: "",
          memberIds: ["m1"],
          primaryContactMemberId: "m2",
        } as any),
      ).rejects.toThrow(BadRequestException)
    })

    it("rejects member ids outside the caller's scope", async () => {
      members.orgMembersWithTags.mockResolvedValue([{ id: "m1", name: "Jo", tags: ["youth"] } as any])
      scope.expandedScope.mockResolvedValue({} as any)
      scope.memberVisible.mockReturnValue(false)

      await expect(
        service.create(auth, { name: "Smiths", address: "", memberIds: ["m1"] } as any),
      ).rejects.toThrow(ForbiddenException)
    })

    it("inserts the household and assigns members inside a transaction", async () => {
      members.orgMembersWithTags.mockResolvedValue([{ id: "m1", name: "Jo", tags: [] } as any])
      scope.expandedScope.mockResolvedValue({} as any)
      scope.memberVisible.mockReturnValue(true)
      households.insert.mockResolvedValue({ id: "h1" } as any)
      households.listSummariesByOrg.mockResolvedValue([
        { id: "h1", name: "Smiths", address: "", primaryContactMemberId: null },
      ])
      households.memberHouseholdIdsByOrg.mockResolvedValue([{ id: "m1", householdId: "h1" }])

      await service.create(auth, { name: "Smiths", address: "", memberIds: ["m1"] } as any)

      expect(db.transaction).toHaveBeenCalled()
      expect(households.insert).toHaveBeenCalledWith(
        expect.objectContaining({ orgId: auth.orgId, name: "Smiths" }),
        db,
      )
      expect(households.assignMembersToHousehold).toHaveBeenCalledWith(auth.orgId, ["m1"], "h1", db)
    })
  })

  describe("removeMember", () => {
    it("404s when the member isn't in that household", async () => {
      households.findByIdInOrg.mockResolvedValue({ id: "h1" } as any)
      households.findMemberHouseholdId.mockResolvedValue({ householdId: "h2" } as any)

      await expect(service.removeMember(auth, "h1", "m1")).rejects.toThrow(NotFoundException)
      expect(households.setMemberHousehold).not.toHaveBeenCalled()
    })

    it("clears the member's household and primary contact pointer", async () => {
      households.findByIdInOrg.mockResolvedValue({ id: "h1" } as any)
      households.findMemberHouseholdId.mockResolvedValue({ householdId: "h1" } as any)
      households.listSummariesByOrg.mockResolvedValue([
        { id: "h1", name: "Smiths", address: "", primaryContactMemberId: null },
      ])
      households.memberHouseholdIdsByOrg.mockResolvedValue([])
      scope.expandedScope.mockResolvedValue({} as any)
      members.orgMembersWithTags.mockResolvedValue([])

      await service.removeMember(auth, "h1", "m1")

      expect(households.setMemberHousehold).toHaveBeenCalledWith(auth.orgId, "m1", null)
      expect(households.clearPrimaryContactIfMember).toHaveBeenCalledWith("h1", "m1")
    })
  })
})
