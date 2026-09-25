import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common"
import { MemberRelationshipsService } from "./member-relationships.service"
import type { MemberRelationshipsRepository } from "./member-relationships.repository"
import type { MembersService } from "./members.service"

function makeRepo(): jest.Mocked<MemberRelationshipsRepository> {
  return {
    findAllInvolving: jest.fn(),
    findCanonical: jest.fn(),
    insert: jest.fn(),
    deleteCanonical: jest.fn(),
  } as unknown as jest.Mocked<MemberRelationshipsRepository>
}

const auth = { orgId: "org-1" } as any

describe("MemberRelationshipsService", () => {
  let repo: jest.Mocked<MemberRelationshipsRepository>
  let members: jest.Mocked<MembersService>
  let service: MemberRelationshipsService

  beforeEach(() => {
    repo = makeRepo()
    members = { detail: jest.fn(), orgMembersWithTags: jest.fn() } as any
    service = new MemberRelationshipsService(repo, members)
  })

  describe("list", () => {
    it("labels each side correctly and drops relations to out-of-scope members", async () => {
      members.detail.mockResolvedValue({} as any)
      members.orgMembersWithTags.mockResolvedValue([{ id: "m1", name: "A" }, { id: "m2", name: "B" }] as any)
      repo.findAllInvolving.mockResolvedValue([
        { memberId: "m1", relatedMemberId: "m2", relationType: "parent_of", createdAt: new Date() },
        { memberId: "m3", relatedMemberId: "m1", relationType: "spouse", createdAt: new Date() },
      ] as any)

      const result = await service.list(auth, "m1")

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({ relatedMemberId: "m2", label: "child" })
    })

    it("reads the object side label when the caller is the related member", async () => {
      members.detail.mockResolvedValue({} as any)
      members.orgMembersWithTags.mockResolvedValue([{ id: "m1", name: "A" }, { id: "m2", name: "B" }] as any)
      repo.findAllInvolving.mockResolvedValue([
        { memberId: "m2", relatedMemberId: "m1", relationType: "parent_of", createdAt: new Date() },
      ] as any)

      const result = await service.list(auth, "m1")

      expect(result[0].label).toBe("parent")
    })
  })

  describe("create", () => {
    it("rejects relating a member to themselves", async () => {
      await expect(
        service.create(auth, "m1", { relatedMemberId: "m1", relationType: "spouse" } as any),
      ).rejects.toThrow(BadRequestException)
    })

    it("canonicalizes symmetric types with the smaller uuid as memberId", async () => {
      members.detail.mockResolvedValue({} as any)
      repo.findCanonical.mockResolvedValue(undefined as any)
      members.orgMembersWithTags.mockResolvedValue([{ id: "aaa", name: "B" }] as any)

      await service.create(auth, "zzz", { relatedMemberId: "aaa", relationType: "spouse" } as any)

      expect(repo.insert).toHaveBeenCalledWith({
        memberId: "aaa",
        relatedMemberId: "zzz",
        relationType: "spouse",
      })
    })

    it("does not canonicalize directional types", async () => {
      members.detail.mockResolvedValue({} as any)
      repo.findCanonical.mockResolvedValue(undefined as any)
      members.orgMembersWithTags.mockResolvedValue([{ id: "aaa", name: "B" }] as any)

      await service.create(auth, "zzz", { relatedMemberId: "aaa", relationType: "parent_of" } as any)

      expect(repo.insert).toHaveBeenCalledWith({
        memberId: "zzz",
        relatedMemberId: "aaa",
        relationType: "parent_of",
      })
    })

    it("rejects a duplicate relationship", async () => {
      members.detail.mockResolvedValue({} as any)
      repo.findCanonical.mockResolvedValue({} as any)

      await expect(
        service.create(auth, "m1", { relatedMemberId: "m2", relationType: "spouse" } as any),
      ).rejects.toThrow(ConflictException)
      expect(repo.insert).not.toHaveBeenCalled()
    })
  })

  describe("remove", () => {
    it("404s when nothing was deleted", async () => {
      members.detail.mockResolvedValue({} as any)
      repo.deleteCanonical.mockResolvedValue(false)

      await expect(service.remove(auth, "m1", "m2", "spouse")).rejects.toThrow(NotFoundException)
    })
  })
})
