import { ConflictException, NotFoundException, UnprocessableEntityException } from "@nestjs/common"
import { CareRequestsService } from "./care-requests.service"
import type { CareRequestRow, CareRequestsRepository } from "./care-requests.repository"
import { ScopeService } from "../authz/scope.service"
import type { AuthContextService } from "../authz/auth-context.service"

function makeRepo(): jest.Mocked<CareRequestsRepository> {
  return {
    list: jest.fn(),
    findById: jest.fn(),
    findMember: jest.fn(),
    tagNamesByMemberIds: jest.fn(),
    orgUsers: jest.fn(),
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
  assignedToId: "u1",
  assignedToName: "Lea",
  dueAt: "2026-09-08",
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
  let authContext: { load: jest.Mock }

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
    // user u2 is scoped to elders, u3 to youth; ctx is built like AuthContextService.load
    const contexts: Record<string, any> = {
      u1: leader,
      u2: { orgId: "org-1", userId: "u2", scopeTagNames: ["elders"] },
      u3: { orgId: "org-1", userId: "u3", scopeTagNames: ["youth"] },
    }
    authContext = { load: jest.fn(async (id: string) => contexts[id] ?? null) } as any
    repo.orgUsers.mockResolvedValue([
      { id: "u1", name: "Lea" },
      { id: "u2", name: "Eli" },
      { id: "u3", name: "Yan" },
    ])
    service = new CareRequestsService(repo, scope, authContext as unknown as AuthContextService)
  })

  afterEach(() => jest.useRealTimers())

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
      jest.useFakeTimers().setSystemTime(new Date("2026-09-01T03:00:00Z")) // 10:00 Jakarta
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
        assignedToUserId: "u1",
        dueAt: "2026-09-08",
      })
      expect(res).toMatchObject({ id: "r1", memberName: "Jo", submittedBy: { id: "u1", name: "Lea" } })
    })

    describe("owner and due date", () => {
      beforeEach(() => {
        jest.useFakeTimers().setSystemTime(new Date("2026-09-01T20:00:00Z")) // already 2 Sep in Jakarta
        repo.findMember.mockResolvedValue({ id: "m1", name: "Jo" })
        repo.tagNamesByMemberIds.mockResolvedValue([{ memberId: "m1", name: "youth" }])
        repo.insert.mockResolvedValue({ id: "r1" })
        repo.findById.mockResolvedValue(row())
      })

      it("defaults due date to 7 days from today in Jakarta", async () => {
        await service.create(leader, { memberId: "m1", type: "care", body: "x" })
        expect(repo.insert).toHaveBeenCalledWith(expect.objectContaining({ dueAt: "2026-09-09" }))
      })

      it("honors an explicit owner who can see the member and an explicit due date", async () => {
        await service.create(leader, { memberId: "m1", type: "care", body: "x", assignedToUserId: "u3", dueAt: "2026-09-20" })
        expect(repo.insert).toHaveBeenCalledWith(expect.objectContaining({ assignedToUserId: "u3", dueAt: "2026-09-20" }))
      })

      it("422s when the owner cannot see the member", async () => {
        await expect(
          service.create(leader, { memberId: "m1", type: "care", body: "x", assignedToUserId: "u2" }),
        ).rejects.toBeInstanceOf(UnprocessableEntityException)
        expect(repo.insert).not.toHaveBeenCalled()
      })

      it("404s when the owner is not in the org", async () => {
        await expect(
          service.create(leader, { memberId: "m1", type: "care", body: "x", assignedToUserId: "stranger" }),
        ).rejects.toBeInstanceOf(NotFoundException)
      })
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

  describe("list filters and overdue", () => {
    it("resolves `me` and the overdue cutoff", async () => {
      jest.useFakeTimers().setSystemTime(new Date("2026-09-10T03:00:00Z"))
      repo.list.mockResolvedValue([])
      repo.tagNamesByMemberIds.mockResolvedValue([])
      await service.list(leader, { assignedToUserId: "me", overdue: true })
      expect(repo.list).toHaveBeenCalledWith("org-1", {
        assignedToUserId: "u1",
        overdueBefore: "2026-09-10",
      })
    })

    it("flags only open requests past due as overdue", async () => {
      jest.useFakeTimers().setSystemTime(new Date("2026-09-10T03:00:00Z"))
      repo.list.mockResolvedValue([
        row({ id: "past", dueAt: "2026-09-09" }),
        row({ id: "today", dueAt: "2026-09-10" }),
        row({ id: "closed", dueAt: "2026-09-01", status: "closed" }),
        row({ id: "none", dueAt: null }),
      ])
      repo.tagNamesByMemberIds.mockResolvedValue([{ memberId: "m1", name: "youth" }])
      const res = await service.list(leader, {})
      expect(Object.fromEntries(res.map((r) => [r.id, r.overdue]))).toEqual({
        past: true, today: false, closed: false, none: false,
      })
    })
  })

  describe("assignees", () => {
    it("returns only users who can see the member", async () => {
      repo.findMember.mockResolvedValue({ id: "m1", name: "Jo" })
      repo.tagNamesByMemberIds.mockResolvedValue([{ memberId: "m1", name: "teens" }])
      const res = await service.assignees(leader, "m1")
      expect(res.map((u) => u.id)).toEqual(["u1", "u3"])
    })

    it("404s for an out-of-scope member", async () => {
      repo.findMember.mockResolvedValue({ id: "m1", name: "Jo" })
      repo.tagNamesByMemberIds.mockResolvedValue([{ memberId: "m1", name: "elders" }])
      await expect(service.assignees(leader, "m1")).rejects.toBeInstanceOf(NotFoundException)
    })
  })

  describe("update owner", () => {
    it("422s when reassigning to a user who cannot see the member", async () => {
      repo.findById.mockResolvedValue(row())
      repo.tagNamesByMemberIds.mockResolvedValue([{ memberId: "m1", name: "youth" }])
      await expect(service.update(leader, "r1", { assignedToUserId: "u2" })).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      )
      expect(repo.update).not.toHaveBeenCalled()
    })

    it("can clear the due date", async () => {
      repo.findById.mockResolvedValue(row())
      repo.tagNamesByMemberIds.mockResolvedValue([{ memberId: "m1", name: "youth" }])
      await service.update(leader, "r1", { dueAt: null })
      expect(repo.update).toHaveBeenCalledWith("org-1", "r1", expect.objectContaining({ dueAt: null }))
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
