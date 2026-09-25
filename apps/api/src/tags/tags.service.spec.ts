import { ConflictException, NotFoundException } from "@nestjs/common"
import { TagsService } from "./tags.service"
import type { TagsRepository } from "./tags.repository"
import type { ScopeService, TagRow } from "../authz/scope.service"
import type { Db } from "../db/drizzle.module"

function makeRepo(): jest.Mocked<TagsRepository> {
  return {
    findIdsByNames: jest.fn(),
    memberTagsByOrg: jest.fn(),
    findByOrgAndName: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    findGroupScopedToTag: jest.fn(),
    reparentChildrenAndDelete: jest.fn(),
  } as unknown as jest.Mocked<TagsRepository>
}

const orgId = "org-1"
const rootTag: TagRow = { id: "t1", name: "youth", parentId: null, description: null }
const childTag: TagRow = { id: "t2", name: "youth-leaders", parentId: "t1", description: null }

describe("TagsService", () => {
  let repo: jest.Mocked<TagsRepository>
  let scope: jest.Mocked<ScopeService>
  let db: jest.Mocked<Db>
  let service: TagsService

  beforeEach(() => {
    repo = makeRepo()
    scope = { orgTags: jest.fn(), toTagDefs: jest.fn() } as any
    db = { transaction: jest.fn((cb: any) => cb(db)) } as any
    service = new TagsService(db, repo, scope)
  })

  describe("resolveTagIds", () => {
    it("returns an empty map for an empty name list without querying", async () => {
      const result = await service.resolveTagIds(orgId, [])
      expect(result.size).toBe(0)
      expect(repo.findIdsByNames).not.toHaveBeenCalled()
    })

    it("throws NotFoundException listing every unknown name", async () => {
      repo.findIdsByNames.mockResolvedValue([{ id: "t1", name: "youth" }])

      await expect(service.resolveTagIds(orgId, ["youth", "elders"])).rejects.toThrow(
        NotFoundException,
      )
    })

    it("maps found names to ids", async () => {
      repo.findIdsByNames.mockResolvedValue([{ id: "t1", name: "youth" }])

      const result = await service.resolveTagIds(orgId, ["youth"])

      expect(result.get("youth")).toBe("t1")
    })
  })

  describe("create", () => {
    it("rejects a duplicate name in the org", async () => {
      repo.findByOrgAndName.mockResolvedValue({ id: "t1" } as any)

      await expect(service.create(orgId, { name: "youth" } as any)).rejects.toThrow(
        ConflictException,
      )
      expect(repo.insert).not.toHaveBeenCalled()
    })

    it("resolves the parent tag id and inserts", async () => {
      repo.findByOrgAndName.mockResolvedValue(undefined as any)
      repo.findIdsByNames.mockResolvedValue([{ id: "t1", name: "youth" }])

      await service.create(orgId, { name: "youth-leaders", parent: "youth" } as any)

      expect(repo.insert).toHaveBeenCalledWith({
        orgId,
        name: "youth-leaders",
        parentId: "t1",
        description: null,
      })
    })
  })

  describe("update", () => {
    it("rejects moving a tag under its own subtree", async () => {
      scope.orgTags.mockResolvedValue([rootTag, childTag])
      scope.toTagDefs.mockReturnValue([
        { name: "youth", parent: null },
        { name: "youth-leaders", parent: "youth" },
      ] as any)

      await expect(
        service.update(orgId, "youth", { parent: "youth-leaders" } as any),
      ).rejects.toThrow(ConflictException)
    })

    it("clears the parent when input.parent is null", async () => {
      scope.orgTags.mockResolvedValue([childTag])

      await service.update(orgId, "youth-leaders", { parent: null } as any)

      expect(repo.update).toHaveBeenCalledWith("t2", { parentId: null })
    })
  })

  describe("remove", () => {
    it("blocks deletion when a group uses the tag as its scope tag", async () => {
      scope.orgTags.mockResolvedValue([rootTag])
      repo.findGroupScopedToTag.mockResolvedValue({ id: "g1", name: "Youth Group" } as any)

      await expect(service.remove(orgId, "youth")).rejects.toThrow(ConflictException)
      expect(repo.reparentChildrenAndDelete).not.toHaveBeenCalled()
    })

    it("reparents children and deletes inside a transaction", async () => {
      scope.orgTags.mockResolvedValue([rootTag])
      repo.findGroupScopedToTag.mockResolvedValue(undefined as any)

      await service.remove(orgId, "youth")

      expect(db.transaction).toHaveBeenCalled()
      expect(repo.reparentChildrenAndDelete).toHaveBeenCalledWith("t1", null, db)
    })
  })
})
