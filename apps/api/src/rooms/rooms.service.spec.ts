import { NotFoundException } from "@nestjs/common"
import { RoomsService } from "./rooms.service"
import type { RoomsRepository } from "./rooms.repository"

function makeRepo(): jest.Mocked<RoomsRepository> {
  return {
    listByOrg: jest.fn(),
    findByIdInOrg: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  } as unknown as jest.Mocked<RoomsRepository>
}

const orgId = "org-1"
const row = {
  id: "room-1",
  orgId,
  name: "Fellowship Hall",
  capacity: 50,
  description: "",
  isActive: true,
  createdAt: new Date(),
}

describe("RoomsService", () => {
  let repo: jest.Mocked<RoomsRepository>
  let service: RoomsService

  beforeEach(() => {
    repo = makeRepo()
    service = new RoomsService(repo)
  })

  describe("list", () => {
    it("sorts rooms by name", async () => {
      repo.listByOrg.mockResolvedValue([
        { ...row, id: "2", name: "Zeta" },
        { ...row, id: "1", name: "Alpha" },
      ])

      const result = await service.list(orgId)

      expect(result.map((r) => r.name)).toEqual(["Alpha", "Zeta"])
      expect(repo.listByOrg).toHaveBeenCalledWith(orgId)
    })
  })

  describe("detail", () => {
    it("returns the mapped room when found", async () => {
      repo.findByIdInOrg.mockResolvedValue(row)

      const result = await service.detail(orgId, row.id)

      expect(result).toEqual({
        id: row.id,
        name: row.name,
        capacity: row.capacity,
        description: row.description,
        isActive: row.isActive,
      })
    })

    it("throws NotFoundException when the repo returns nothing", async () => {
      repo.findByIdInOrg.mockResolvedValue(undefined as any)

      await expect(service.detail(orgId, "missing")).rejects.toThrow(NotFoundException)
    })
  })

  describe("create", () => {
    it("defaults capacity to null when not provided", async () => {
      repo.insert.mockResolvedValue(row)

      await service.create(orgId, {
        name: "Fellowship Hall",
        description: "",
        isActive: true,
      } as any)

      expect(repo.insert).toHaveBeenCalledWith(
        orgId,
        expect.objectContaining({ capacity: null }),
      )
    })
  })

  describe("update", () => {
    it("checks existence before patching (404 on missing room)", async () => {
      repo.findByIdInOrg.mockResolvedValue(undefined as any)

      await expect(service.update(orgId, "missing", { name: "x" } as any)).rejects.toThrow(
        NotFoundException,
      )
      expect(repo.update).not.toHaveBeenCalled()
    })

    it("only patches fields present on the input", async () => {
      repo.findByIdInOrg.mockResolvedValue(row)
      repo.update.mockResolvedValue({ ...row, name: "New Name" })

      await service.update(orgId, row.id, { name: "New Name" } as any)

      expect(repo.update).toHaveBeenCalledWith(orgId, row.id, { name: "New Name" })
    })
  })

  describe("remove", () => {
    it("checks existence before deleting", async () => {
      repo.findByIdInOrg.mockResolvedValue(undefined as any)

      await expect(service.remove(orgId, "missing")).rejects.toThrow(NotFoundException)
      expect(repo.delete).not.toHaveBeenCalled()
    })

    it("deletes once existence is confirmed", async () => {
      repo.findByIdInOrg.mockResolvedValue(row)

      await service.remove(orgId, row.id)

      expect(repo.delete).toHaveBeenCalledWith(orgId, row.id)
    })
  })
})
