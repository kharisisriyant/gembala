import { NotFoundException } from "@nestjs/common"
import { MembersService } from "./members.service"
import type { MembersRepository } from "./members.repository"
import type { ScopeService } from "../authz/scope.service"
import type { TagsService } from "../tags/tags.service"
import type { Db } from "../db/drizzle.module"

function makeRepo(): jest.Mocked<MembersRepository> {
  return {
    listByOrg: jest.fn(),
    tagsByOrg: jest.fn(),
    groupsByMemberId: jest.fn(),
    insert: jest.fn(),
    insertTags: jest.fn(),
    update: jest.fn(),
    replaceTags: jest.fn(),
  } as unknown as jest.Mocked<MembersRepository>
}

const auth = { orgId: "org-1" } as any
const memberRow = {
  id: "m1",
  orgId: "org-1",
  name: "Jo",
  email: "jo@x.com",
  phone: "",
  status: "active" as const,
  joinedAt: "2026-01-01",
  dateOfBirth: null,
  gender: null,
  maritalStatus: null,
  address: "",
  occupation: "",
  notes: "",
  photoUrl: "",
  baptismStatus: null,
  baptismDate: null,
  householdId: null,
  createdAt: new Date(),
}

describe("MembersService", () => {
  let repo: jest.Mocked<MembersRepository>
  let scope: jest.Mocked<ScopeService>
  let tags: jest.Mocked<TagsService>
  let db: jest.Mocked<Db>
  let service: MembersService

  beforeEach(() => {
    repo = makeRepo()
    scope = { expandedScope: jest.fn(), memberVisible: jest.fn(), assertCanWriteMemberTags: jest.fn() } as any
    tags = { resolveTagIds: jest.fn() } as any
    db = { transaction: jest.fn((cb: any) => cb(db)) } as any
    service = new MembersService(db, repo, scope, tags)
  })

  describe("orgMembersWithTags", () => {
    it("attaches sorted tag names per member", async () => {
      repo.listByOrg.mockResolvedValue([memberRow])
      repo.tagsByOrg.mockResolvedValue([
        { memberId: "m1", name: "zeta" },
        { memberId: "m1", name: "alpha" },
      ] as any)

      const result = await service.orgMembersWithTags("org-1")

      expect(result[0].tags).toEqual(["alpha", "zeta"])
    })
  })

  describe("list", () => {
    it("filters to scope and applies search + tag filters", async () => {
      repo.listByOrg.mockResolvedValue([
        memberRow,
        { ...memberRow, id: "m2", name: "Sam", email: "sam@x.com" },
      ])
      repo.tagsByOrg.mockResolvedValue([])
      scope.expandedScope.mockResolvedValue({} as any)
      scope.memberVisible.mockReturnValue(true)

      const result = await service.list(auth, "sam")

      expect(result.map((m) => m.id)).toEqual(["m2"])
    })

    it("excludes members outside the caller's scope", async () => {
      repo.listByOrg.mockResolvedValue([memberRow])
      repo.tagsByOrg.mockResolvedValue([])
      scope.expandedScope.mockResolvedValue({} as any)
      scope.memberVisible.mockReturnValue(false)

      const result = await service.list(auth)

      expect(result).toEqual([])
    })
  })

  describe("detail", () => {
    it("404s for unknown member", async () => {
      repo.listByOrg.mockResolvedValue([])
      repo.tagsByOrg.mockResolvedValue([])
      scope.expandedScope.mockResolvedValue({} as any)

      await expect(service.detail(auth, "missing")).rejects.toThrow(NotFoundException)
    })

    it("404s for a member outside scope (doesn't leak existence)", async () => {
      repo.listByOrg.mockResolvedValue([memberRow])
      repo.tagsByOrg.mockResolvedValue([])
      scope.expandedScope.mockResolvedValue({} as any)
      scope.memberVisible.mockReturnValue(false)

      await expect(service.detail(auth, "m1")).rejects.toThrow(NotFoundException)
    })

    it("attaches groups for a visible member", async () => {
      repo.listByOrg.mockResolvedValue([memberRow])
      repo.tagsByOrg.mockResolvedValue([])
      scope.expandedScope.mockResolvedValue({} as any)
      scope.memberVisible.mockReturnValue(true)
      repo.groupsByMemberId.mockResolvedValue([{ id: "g1", name: "Youth" }] as any)

      const result = await service.detail(auth, "m1")

      expect(result.groups).toEqual([{ id: "g1", name: "Youth" }])
    })
  })

  describe("create", () => {
    it("asserts write access to the given tags before inserting", async () => {
      scope.expandedScope.mockResolvedValue({} as any)
      scope.assertCanWriteMemberTags.mockImplementation(() => {
        throw new Error("forbidden")
      })

      await expect(
        service.create(auth, { name: "Jo", tags: ["restricted"] } as any),
      ).rejects.toThrow("forbidden")
      expect(repo.insert).not.toHaveBeenCalled()
    })

    it("inserts the member and its tags inside a transaction", async () => {
      scope.expandedScope.mockResolvedValue({} as any)
      tags.resolveTagIds.mockResolvedValue(new Map([["youth", "t1"]]))
      repo.insert.mockResolvedValue(memberRow)

      await service.create(auth, { name: "Jo", tags: ["youth"] } as any)

      expect(db.transaction).toHaveBeenCalled()
      expect(repo.insertTags).toHaveBeenCalledWith("m1", ["t1"], db)
    })
  })

  describe("importMany", () => {
    it("collects per-row errors without failing the whole batch", async () => {
      scope.expandedScope.mockResolvedValue({} as any)
      tags.resolveTagIds
        .mockResolvedValueOnce(new Map([["youth", "t1"]]))
        .mockRejectedValueOnce(new Error("unknown tag(s): bogus"))
      repo.insert.mockResolvedValue(memberRow)

      const result = await service.importMany(auth, [
        { name: "Jo", tags: ["youth"] } as any,
        { name: "Bad Row", tags: ["bogus"] } as any,
      ])

      expect(result.created).toHaveLength(1)
      expect(result.errors).toEqual([{ row: 1, name: "Bad Row", message: "unknown tag(s): bogus" }])
    })
  })

  describe("update", () => {
    it("only replaces tags when input.tags is provided", async () => {
      repo.listByOrg.mockResolvedValue([memberRow])
      repo.tagsByOrg.mockResolvedValue([])
      scope.expandedScope.mockResolvedValue({} as any)
      scope.memberVisible.mockReturnValue(true)

      await service.update(auth, "m1", { name: "New Name" } as any)

      expect(repo.replaceTags).not.toHaveBeenCalled()
      expect(repo.update).toHaveBeenCalledWith(auth.orgId, "m1", { name: "New Name" }, db)
    })
  })
})
