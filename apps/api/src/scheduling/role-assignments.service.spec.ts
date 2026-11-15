import { ConflictException, NotFoundException } from "@nestjs/common"
import { RoleAssignmentsService } from "./role-assignments.service"
import type { RoleAssignmentsRepository } from "./role-assignments.repository"
import type { RoleTemplatesService } from "./role-templates.service"

function makeRepo(): jest.Mocked<RoleAssignmentsRepository> {
  return {
    findInstanceInOrg: jest.fn(),
    findMemberInOrg: jest.fn(),
    findAssignmentInOrg: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  } as unknown as jest.Mocked<RoleAssignmentsRepository>
}

const orgId = "org-1"

describe("RoleAssignmentsService", () => {
  let repo: jest.Mocked<RoleAssignmentsRepository>
  let roleTemplates: jest.Mocked<RoleTemplatesService>
  let service: RoleAssignmentsService

  beforeEach(() => {
    repo = makeRepo()
    roleTemplates = { detail: jest.fn() } as any
    service = new RoleAssignmentsService(repo, roleTemplates)
  })

  describe("create", () => {
    it("404s when the instance doesn't exist in this org", async () => {
      repo.findInstanceInOrg.mockResolvedValue(undefined as any)

      await expect(
        service.create(orgId, "missing", { roleTemplateId: "rt1", sortOrder: 0 } as any),
      ).rejects.toThrow(NotFoundException)
      expect(repo.insert).not.toHaveBeenCalled()
    })

    it("rejects an inactive role template", async () => {
      repo.findInstanceInOrg.mockResolvedValue({ id: "si1" } as any)
      roleTemplates.detail.mockResolvedValue({ id: "rt1", name: "Vocalist", sortOrder: 0, isActive: false })

      await expect(
        service.create(orgId, "si1", { roleTemplateId: "rt1", sortOrder: 0 } as any),
      ).rejects.toThrow(ConflictException)
    })

    it("404s when memberId doesn't resolve to a member in this org", async () => {
      repo.findInstanceInOrg.mockResolvedValue({ id: "si1" } as any)
      roleTemplates.detail.mockResolvedValue({ id: "rt1", name: "Vocalist", sortOrder: 0, isActive: true })
      repo.findMemberInOrg.mockResolvedValue(undefined as any)

      await expect(
        service.create(orgId, "si1", { roleTemplateId: "rt1", memberId: "ghost", sortOrder: 0 } as any),
      ).rejects.toThrow(NotFoundException)
    })

    it("allows an unassigned freeText-only assignment", async () => {
      repo.findInstanceInOrg.mockResolvedValue({ id: "si1" } as any)
      roleTemplates.detail.mockResolvedValue({ id: "rt1", name: "Vocalist", sortOrder: 0, isActive: true })
      repo.insert.mockResolvedValue({
        id: "ra1",
        serviceInstanceId: "si1",
        roleTemplateId: "rt1",
        memberId: null,
        freeText: "TBD",
        sortOrder: 0,
      } as any)

      const result = await service.create(orgId, "si1", { roleTemplateId: "rt1", freeText: "TBD", sortOrder: 0 } as any)

      expect(result.member).toBeNull()
      expect(repo.findMemberInOrg).not.toHaveBeenCalled()
    })
  })

  describe("remove", () => {
    it("404s on unknown assignment", async () => {
      repo.findAssignmentInOrg.mockResolvedValue(undefined as any)

      await expect(service.remove(orgId, "missing")).rejects.toThrow(NotFoundException)
      expect(repo.delete).not.toHaveBeenCalled()
    })
  })

  describe("update confirmation reset", () => {
    const existing = {
      id: "ra1",
      serviceInstanceId: "si1",
      roleTemplateId: "rt1",
      memberId: "m1",
      freeText: "",
      sortOrder: 0,
      linkNonce: "n1",
      responseStatus: "confirmed",
      respondedAt: new Date("2026-11-20T00:00:00Z"),
      declineReason: "",
      notifiedAt: new Date("2026-11-19T00:00:00Z"),
      requestedByUserId: "u1",
    }

    beforeEach(() => {
      repo.findAssignmentInOrg.mockResolvedValue(existing as any)
      roleTemplates.detail.mockResolvedValue({ id: "rt1", name: "Usher", sortOrder: 0, isActive: true })
      repo.findMemberInOrg.mockImplementation(async (_o, id) => ({ id, name: "X" }) as any)
      repo.update.mockImplementation(async (_id, patch) => ({ ...existing, ...patch }) as any)
    })

    it("keeps the answer and the link when only the order changes", async () => {
      const result = await service.update(orgId, "ra1", { roleTemplateId: "rt1", memberId: "m1", sortOrder: 3 } as any)
      expect(repo.update.mock.calls[0][1]).not.toHaveProperty("linkNonce")
      expect(result.confirmation.status).toBe("confirmed")
    })

    it("resets the answer and rotates the link when the member changes", async () => {
      const result = await service.update(orgId, "ra1", { roleTemplateId: "rt1", memberId: "m2", sortOrder: 0 } as any)
      const patch = repo.update.mock.calls[0][1]
      expect(patch.linkNonce).toEqual(expect.any(String))
      expect(patch.linkNonce).not.toBe("n1")
      expect(patch).toMatchObject({ responseStatus: "pending", respondedAt: null, notifiedAt: null, requestedByUserId: null })
      expect(result.confirmation).toEqual({ status: "pending", respondedAt: null, declineReason: "", notifiedAt: null })
    })

    it("resets when the role changes", async () => {
      roleTemplates.detail.mockResolvedValue({ id: "rt2", name: "Lector", sortOrder: 0, isActive: true })
      await service.update(orgId, "ra1", { roleTemplateId: "rt2", memberId: "m1", sortOrder: 0 } as any)
      expect(repo.update.mock.calls[0][1]).toMatchObject({ responseStatus: "pending" })
    })
  })
})
