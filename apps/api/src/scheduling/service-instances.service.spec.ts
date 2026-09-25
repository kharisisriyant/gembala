import { ConflictException, NotFoundException } from "@nestjs/common"
import { ServiceInstancesService } from "./service-instances.service"
import type { ServiceInstancesRepository } from "./service-instances.repository"
import type { InstanceTypesService } from "./instance-types.service"

function makeRepo(): jest.Mocked<ServiceInstancesRepository> {
  return {
    findEventInOrg: jest.fn(),
    findInstanceInOrg: jest.fn(),
    insert: jest.fn(),
    delete: jest.fn(),
  } as unknown as jest.Mocked<ServiceInstancesRepository>
}

const orgId = "org-1"

describe("ServiceInstancesService", () => {
  let repo: jest.Mocked<ServiceInstancesRepository>
  let instanceTypes: jest.Mocked<InstanceTypesService>
  let service: ServiceInstancesService

  beforeEach(() => {
    repo = makeRepo()
    instanceTypes = { detail: jest.fn() } as any
    service = new ServiceInstancesService(repo, instanceTypes)
  })

  describe("create", () => {
    it("404s when the event doesn't exist in this org", async () => {
      repo.findEventInOrg.mockResolvedValue(undefined as any)

      await expect(
        service.create(orgId, "missing", { instanceTypeId: "it1", sortOrder: 0 } as any),
      ).rejects.toThrow(NotFoundException)
      expect(repo.insert).not.toHaveBeenCalled()
    })

    it("rejects an inactive instance type", async () => {
      repo.findEventInOrg.mockResolvedValue({ id: "e1" } as any)
      instanceTypes.detail.mockResolvedValue({ id: "it1", name: "Worship", sortOrder: 0, isActive: false })

      await expect(
        service.create(orgId, "e1", { instanceTypeId: "it1", sortOrder: 0 } as any),
      ).rejects.toThrow(ConflictException)
      expect(repo.insert).not.toHaveBeenCalled()
    })

    it("creates when the event exists and the instance type is active", async () => {
      repo.findEventInOrg.mockResolvedValue({ id: "e1" } as any)
      instanceTypes.detail.mockResolvedValue({ id: "it1", name: "Worship", sortOrder: 0, isActive: true })
      repo.insert.mockResolvedValue({ id: "si1", eventId: "e1", instanceTypeId: "it1", sortOrder: 0 } as any)

      const result = await service.create(orgId, "e1", { instanceTypeId: "it1", sortOrder: 0 } as any)

      expect(result.instanceType).toEqual({ id: "it1", name: "Worship" })
    })
  })

  describe("remove", () => {
    it("404s on unknown instance", async () => {
      repo.findInstanceInOrg.mockResolvedValue(undefined as any)

      await expect(service.remove(orgId, "missing")).rejects.toThrow(NotFoundException)
      expect(repo.delete).not.toHaveBeenCalled()
    })
  })
})
