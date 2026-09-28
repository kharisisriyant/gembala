import { ConflictException, NotFoundException } from "@nestjs/common"
import { CareRequestsService } from "./care-requests.service"
import type { CareRequestRow, CareRequestsRepository } from "./care-requests.repository"
import { ScopeService } from "../authz/scope.service"

function makeRepo(): jest.Mocked<CareRequestsRepository> {
  return {
    list: jest.fn(),
    findById: jest.fn(),
    findMember: jest.fn(),
    tagNamesByMemberIds: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  } as unknown as jest.Mocked<CareRequestsRepository>
}

const leader = { orgId: "org-1", userId: "u1", scopeTagNames: ["youth"] } as any
const admin = { orgId: "org-1", userId: "u0", scopeTagNames: null } as any

const row = (over: Partial<CareRequestRow> = {}): CareRequestRow => ({
  id: "r1",
  memberId: "m1",
  memberName: "Jo",
  type: "prayer",
  body: "please pray",
  status: "open",
  source: "leader",
  submittedById: "u1",
  submittedByName: "Lea",
  closedAt: null,
  closedById: null,
  closedByName: null,
  closeNote: null,
  createdAt: new Date("2026-09-01T00:00:00Z"),
  updatedAt: new Date("2026-09-01T00:00:00Z"),
  ...over,
})

describe("CareRequestsService", () => {
  let repo: jest.Mocked<CareRequestsRepository>
  let scope: ScopeService
  let service: CareRequestsService

  beforeEach(() => {
    repo = makeRepo()
    // real ScopeService over a stub repo: tag tree = youth (root), teens (child of youth), elders (root)
    scope = new ScopeService({
      orgTags: jest.fn().mockResolvedValue([
        { id: "t1", name: "youth", parentId: null, description: null },
        { id: "t2", name: "teens", parentId: "t1", description: null },
        { id: "t3", name: "elders", parentId: null, description: null },
      ]),
    } as any)
    service = new CareRequestsService(repo, scope)
  })

  describe("create", () => {
    it("404s for a missing member", async () => {
      repo.findMember.mockResolvedValue(undefined)
      await expect(
        service.create(leader, { memberId: "m1", type: "prayer", body: "x" }),
      ).rejects.toBeInstanceOf(NotFoundException)
      expect(repo.insert).not.toHaveBeenCalled()
    })

    it("404s for an out-of-scope member", async () => {
      repo.findMember.mockResolvedValue({ id: "m1", name: "Jo" })
      repo.tagNamesByMemberIds.mockResolvedValue([{ memberId: "m1", name: "elders" }])
      await expect(
        service.create(leader, { memberId: "m1", type: "prayer", body: "x" }),
      ).rejects.toBeInstanceOf(NotFoundException)
      expect(repo.insert).not.toHaveBeenCalled()
    })

    it("404s for an untagged member when caller is not admin", async () => {
      repo.findMember.mockResolvedValue({ id: "m1", name: "Jo" })
      repo.tagNamesByMemberIds.mockResolvedValue([])
      await expect(
        service.create(leader, { memberId: "m1", type: "care", body: "x" }),
      ).rejects.toBeInstanceOf(NotFoundException)
    })

    it("records leader source and submitter", async () => {
      repo.findMember.mockResolvedValue({ id: "m1", name: "Jo" })
      repo.tagNamesByMemberIds.mockResolvedValue([{ memberId: "m1", name: "teens" }]) // descendant of youth
      repo.insert.mockResolvedValue({ id: "r1" })
      repo.findById.mockResolvedValue(row())
      const res = await service.create(leader, { memberId: "m1", type: "prayer", body: "please pray" })
      expect(repo.insert).toHaveBeenCalledWith({
        orgId: "org-1",
        memberId: "m1",
        type: "prayer",
        body: "please pray",
        source: "leader",
        submittedByUserId: "u1",
      })
      expect(res).toMatchObject({ id: "r1", memberName: "Jo", submittedBy: { id: "u1", name: "Lea" } })
    })

    it("admin can create for an untagged member", async () => {
      repo.findMember.mockResolvedValue({ id: "m1", name: "Jo" })
      repo.tagNamesByMemberIds.mockResolvedValue([])
      repo.insert.mockResolvedValue({ id: "r1" })
      repo.findById.mockResolvedValue(row())
      await expect(
        service.create(admin, { memberId: "m1", type: "care", body: "x" }),
      ).resolves.toBeDefined()
    })
  })

  describe("list", () => {
    it("filters out requests whose member is out of scope", async () => {
      repo.list.mockResolvedValue([
        row({ id: "r1", memberId: "m1" }),
        row({ id: "r2", memberId: "m2" }),
        row({ id: "r3", memberId: "m3" }),
      ])
      repo.tagNamesByMemberIds.mockResolvedValue([
        { memberId: "m1", name: "youth" },
        { memberId: "m2", name: "elders" },
        // m3 has no tags
      ])
      const res = await service.list(leader, {})
      expect(res.map((r) => r.id)).toEqual(["r1"])
    })

    it("admin sees everything, including untagged members", async () => {
      repo.list.mockResolvedValue([row({ id: "r1" }), row({ id: "r2", memberId: "m2" })])
      repo.tagNamesByMemberIds.mockResolvedValue([])
      const res = await service.list(admin, { status: "open" })
      expect(res.map((r) => r.id)).toEqual(["r1", "r2"])
      expect(repo.list).toHaveBeenCalledWith("org-1", { status: "open" })
    })
  })

  describe("get", () => {
    it("404s for an unknown id", async () => {
      repo.findById.mockResolvedValue(undefined)
      await expect(service.get(leader, "r1")).rejects.toBeInstanceOf(NotFoundException)
    })

    it("404s when the member is out of scope", async () => {
      repo.findById.mockResolvedValue(row())
      repo.tagNamesByMemberIds.mockResolvedValue([{ memberId: "m1", name: "elders" }])
      await expect(service.get(leader, "r1")).rejects.toBeInstanceOf(NotFoundException)
    })
  })

  describe("status transitions", () => {
    beforeEach(() => {
      repo.tagNamesByMemberIds.mockResolvedValue([{ memberId: "m1", name: "youth" }])
    })

    it("update on a closed request → 409", async () => {
      repo.findById.mockResolvedValue(row({ status: "closed" }))
      await expect(service.update(leader, "r1", { body: "new" })).rejects.toBeInstanceOf(ConflictException)
      expect(repo.update).not.toHaveBeenCalled()
    })

    it("update on an open request patches type/body", async () => {
      repo.findById.mockResolvedValue(row())
      await service.update(leader, "r1", { body: "new" })
      expect(repo.update).toHaveBeenCalledWith("org-1", "r1", { type: undefined, body: "new" })
    })

    it("close sets closed fields", async () => {
      repo.findById.mockResolvedValue(row())
      await service.close(leader, "r1", { note: "answered" })
      expect(repo.update).toHaveBeenCalledWith(
        "org-1",
        "r1",
        expect.objectContaining({ status: "closed", closedByUserId: "u1", closeNote: "answered", closedAt: expect.any(Date) }),
      )
    })

    it("close without a note stores null", async () => {
      repo.findById.mockResolvedValue(row())
      await service.close(leader, "r1", {})
      expect(repo.update).toHaveBeenCalledWith("org-1", "r1", expect.objectContaining({ closeNote: null }))
    })

    it("close on a closed request → 409", async () => {
      repo.findById.mockResolvedValue(row({ status: "closed" }))
      await expect(service.close(leader, "r1", {})).rejects.toBeInstanceOf(ConflictException)
    })

    it("reopen clears closed fields", async () => {
      repo.findById.mockResolvedValue(row({ status: "closed" }))
      await service.reopen(leader, "r1")
      expect(repo.update).toHaveBeenCalledWith("org-1", "r1", {
        status: "open",
        closedAt: null,
        closedByUserId: null,
        closeNote: null,
      })
    })

    it("reopen on an open request → 409", async () => {
      repo.findById.mockResolvedValue(row())
      await expect(service.reopen(leader, "r1")).rejects.toBeInstanceOf(ConflictException)
    })
  })

  describe("remove", () => {
    it("deletes when visible", async () => {
      repo.findById.mockResolvedValue(row())
      repo.tagNamesByMemberIds.mockResolvedValue([{ memberId: "m1", name: "youth" }])
      await service.remove(leader, "r1")
      expect(repo.delete).toHaveBeenCalledWith("org-1", "r1")
    })

    it("404s when out of scope and does not delete", async () => {
      repo.findById.mockResolvedValue(row())
      repo.tagNamesByMemberIds.mockResolvedValue([{ memberId: "m1", name: "elders" }])
      await expect(service.remove(leader, "r1")).rejects.toBeInstanceOf(NotFoundException)
      expect(repo.delete).not.toHaveBeenCalled()
    })
  })
})
