import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common"
import { PastoralNotesService } from "./pastoral-notes.service"
import type { PastoralNoteRow, PastoralNotesRepository } from "./pastoral-notes.repository"
import { ScopeService } from "../authz/scope.service"

function makeRepo(): jest.Mocked<PastoralNotesRepository> {
  return {
    listForMember: jest.fn(),
    findById: jest.fn(),
    findMember: jest.fn(),
    memberTagNames: jest.fn(),
    insert: jest.fn(),
    updateBody: jest.fn(),
    delete: jest.fn(),
  } as unknown as jest.Mocked<PastoralNotesRepository>
}

const perms = new Set(["members:read", "members:update"])
// u1 wrote the note; u2 is another youth leader (same scope); u3 leads elders only.
const author = { orgId: "org-1", userId: "u1", isSystemAdmin: false, permissions: perms, scopeTagNames: ["youth"] } as any
const otherLeader = { orgId: "org-1", userId: "u2", isSystemAdmin: false, permissions: perms, scopeTagNames: ["youth"] } as any
const outOfScope = { orgId: "org-1", userId: "u3", isSystemAdmin: false, permissions: perms, scopeTagNames: ["elders"] } as any
const admin = { orgId: "org-1", userId: "u0", isSystemAdmin: true, permissions: new Set(), scopeTagNames: null } as any
const otherOrgAdmin = { orgId: "org-2", userId: "u9", isSystemAdmin: true, permissions: new Set(), scopeTagNames: null } as any
const readOnly = { ...otherLeader, userId: "u1", permissions: new Set(["members:read"]) } as any

const note = (over: Partial<PastoralNoteRow> = {}): PastoralNoteRow => ({
  id: "n1",
  orgId: "org-1",
  memberId: "m1",
  authorId: "u1",
  authorName: "Lea",
  body: "Called her; mother is in hospital",
  source: "web",
  createdAt: new Date("2026-11-01T00:00:00Z"),
  updatedAt: new Date("2026-11-01T00:00:00Z"),
  ...over,
})

describe("PastoralNotesService", () => {
  let repo: jest.Mocked<PastoralNotesRepository>
  let service: PastoralNotesService

  beforeEach(() => {
    repo = makeRepo()
    // Real ScopeService over a stub tag tree: youth (root), elders (root).
    const scope = new ScopeService({
      orgTags: jest.fn().mockResolvedValue([
        { id: "t1", name: "youth", parentId: null, description: null },
        { id: "t3", name: "elders", parentId: null, description: null },
      ]),
    } as any)
    // Member m1 lives in org-1, tagged youth. Repository is org-scoped like the real one.
    repo.findMember.mockImplementation(async (orgId, memberId) =>
      orgId === "org-1" && memberId === "m1" ? { id: "m1" } : undefined,
    )
    repo.memberTagNames.mockResolvedValue(["youth"])
    repo.findById.mockImplementation(async (orgId, id) => (orgId === "org-1" && id === "n1" ? note() : undefined))
    // Mirrors the SQL: optional author filter.
    const all = [note(), note({ id: "n2", authorId: "u2", authorName: "Eli", body: "Eli's note" })]
    repo.listForMember.mockImplementation(async (orgId, memberId, authorUserId) =>
      all.filter((n) => n.orgId === orgId && n.memberId === memberId && (!authorUserId || n.authorId === authorUserId)),
    )
    service = new PastoralNotesService(repo, scope)
  })

  describe("list", () => {
    it("author sees only their own notes, with edit and delete rights", async () => {
      const res = await service.list(author, "m1")
      expect(res.map((n) => n.id)).toEqual(["n1"])
      expect(res[0]).toMatchObject({ body: "Called her; mother is in hospital", author: { id: "u1", name: "Lea" }, canEdit: true, canDelete: true })
      expect(repo.listForMember).toHaveBeenCalledWith("org-1", "m1", "u1")
    })

    it("another in-scope leader never sees someone else's note", async () => {
      const res = await service.list(otherLeader, "m1")
      expect(res.map((n) => n.id)).toEqual(["n2"])
      expect(res.some((n) => n.body.includes("hospital"))).toBe(false)
    })

    it("filters other authors' notes even if the repository returned them", async () => {
      repo.listForMember.mockResolvedValue([note(), note({ id: "n2", authorId: "u2" })])
      const res = await service.list({ ...otherLeader, userId: "u5" }, "m1")
      expect(res).toEqual([])
    })

    it("admin sees every note, can delete but not edit others'", async () => {
      const res = await service.list(admin, "m1")
      expect(res.map((n) => n.id)).toEqual(["n1", "n2"])
      expect(res[0]).toMatchObject({ canEdit: false, canDelete: true })
      expect(repo.listForMember).toHaveBeenCalledWith("org-1", "m1", undefined)
    })

    it("member outside the caller's tag scope is 404", async () => {
      await expect(service.list(outOfScope, "m1")).rejects.toBeInstanceOf(NotFoundException)
      expect(repo.listForMember).not.toHaveBeenCalled()
    })

    it("member in another org is 404", async () => {
      await expect(service.list(otherOrgAdmin, "m1")).rejects.toBeInstanceOf(NotFoundException)
      expect(repo.listForMember).not.toHaveBeenCalled()
    })

    it("a note whose author was deleted stays visible to admins only", async () => {
      repo.listForMember.mockResolvedValue([note({ authorId: null, authorName: null })])
      expect(await service.list(admin, "m1")).toEqual([expect.objectContaining({ author: null, canEdit: false, canDelete: true })])
      repo.listForMember.mockResolvedValue([note({ authorId: null, authorName: null })])
      expect(await service.list(author, "m1")).toEqual([])
    })

    it("rejects a caller without members:read (non-HTTP callers)", async () => {
      await expect(service.list({ ...author, permissions: new Set() }, "m1")).rejects.toBeInstanceOf(ForbiddenException)
    })
  })

  describe("get", () => {
    it("author and admin can read the note", async () => {
      expect((await service.get(author, "n1")).body).toContain("hospital")
      expect((await service.get(admin, "n1")).id).toBe("n1")
    })

    it("another in-scope leader gets 404, not 403", async () => {
      await expect(service.get(otherLeader, "n1")).rejects.toBeInstanceOf(NotFoundException)
    })

    it("note from another org is 404 even for that org's admin", async () => {
      await expect(service.get(otherOrgAdmin, "n1")).rejects.toBeInstanceOf(NotFoundException)
    })

    it("author whose scope no longer covers the member gets 404", async () => {
      await expect(service.get({ ...author, scopeTagNames: ["elders"] }, "n1")).rejects.toBeInstanceOf(NotFoundException)
    })
  })

  describe("create", () => {
    beforeEach(() => {
      repo.insert.mockResolvedValue({ id: "n1" })
    })

    it("records the caller as author with the given source and trims the body", async () => {
      const res = await service.create(author, "m1", "  Called her; mother is in hospital \n", "telegram")
      expect(repo.insert).toHaveBeenCalledWith({
        orgId: "org-1",
        memberId: "m1",
        authorUserId: "u1",
        body: "Called her; mother is in hospital",
        source: "telegram",
      })
      expect(res).toMatchObject({ id: "n1", canEdit: true, canDelete: true })
    })

    it("member outside scope or in another org is 404 and nothing is written", async () => {
      await expect(service.create(outOfScope, "m1", "x", "web")).rejects.toBeInstanceOf(NotFoundException)
      await expect(service.create(otherOrgAdmin, "m1", "x", "web")).rejects.toBeInstanceOf(NotFoundException)
      await expect(service.create(author, "missing", "x", "web")).rejects.toBeInstanceOf(NotFoundException)
      expect(repo.insert).not.toHaveBeenCalled()
    })

    it("requires members:update and a non-blank body (non-HTTP callers)", async () => {
      await expect(service.create(readOnly, "m1", "x", "telegram")).rejects.toBeInstanceOf(ForbiddenException)
      await expect(service.create(author, "m1", "   ", "telegram")).rejects.toBeInstanceOf(BadRequestException)
      expect(repo.insert).not.toHaveBeenCalled()
    })
  })

  describe("update", () => {
    it("author can edit", async () => {
      await service.update(author, "n1", " new words ")
      expect(repo.updateBody).toHaveBeenCalledWith("org-1", "n1", "new words")
    })

    it("another in-scope leader gets 404", async () => {
      await expect(service.update(otherLeader, "n1", "x")).rejects.toBeInstanceOf(NotFoundException)
      expect(repo.updateBody).not.toHaveBeenCalled()
    })

    it("admin cannot rewrite someone else's note", async () => {
      await expect(service.update(admin, "n1", "x")).rejects.toBeInstanceOf(ForbiddenException)
      expect(repo.updateBody).not.toHaveBeenCalled()
    })

    it("missing note or one in another org is 404", async () => {
      await expect(service.update(author, "nope", "x")).rejects.toBeInstanceOf(NotFoundException)
      await expect(service.update(otherOrgAdmin, "n1", "x")).rejects.toBeInstanceOf(NotFoundException)
    })
  })

  describe("remove", () => {
    it("author can delete", async () => {
      await service.remove(author, "n1")
      expect(repo.delete).toHaveBeenCalledWith("org-1", "n1")
    })

    it("admin can delete", async () => {
      await service.remove(admin, "n1")
      expect(repo.delete).toHaveBeenCalledWith("org-1", "n1")
    })

    it("another in-scope leader or out-of-scope leader gets 404", async () => {
      await expect(service.remove(otherLeader, "n1")).rejects.toBeInstanceOf(NotFoundException)
      await expect(service.remove(outOfScope, "n1")).rejects.toBeInstanceOf(NotFoundException)
      await expect(service.remove(otherOrgAdmin, "n1")).rejects.toBeInstanceOf(NotFoundException)
      expect(repo.delete).not.toHaveBeenCalled()
    })
  })
})
