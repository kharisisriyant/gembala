import { NotFoundException } from "@nestjs/common"
import { InstanceTypesService } from "./instance-types.service"
import type { InstanceTypesRepository } from "./instance-types.repository"

function makeRepo(): jest.Mocked<InstanceTypesRepository> {
  return {
    listByOrg: jest.fn(),
    findByIdInOrg: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
  } as unknown as jest.Mocked<InstanceTypesRepository>
}

const orgId = "org-1"
const row = { id: "it1", orgId, name: "Worship", sortOrder: 1, isActive: true, createdAt: new Date() }

describe("InstanceTypesService", () => {
  let repo: jest.Mocked<InstanceTypesRepository>
  let service: InstanceTypesService

  beforeEach(() => {
    repo = makeRepo()
    service = new InstanceTypesService(repo)
  })

  it("sorts by sortOrder", async () => {
    repo.listByOrg.mockResolvedValue([
      { ...row, id: "2", sortOrder: 2 },
      { ...row, id: "1", sortOrder: 1 },
    ])

    const result = await service.list(orgId)

    expect(result.map((r) => r.id)).toEqual(["1", "2"])
  })

  it("404s on unknown id", async () => {
    repo.findByIdInOrg.mockResolvedValue(undefined as any)

    await expect(service.detail(orgId, "missing")).rejects.toThrow(NotFoundException)
  })

  it("remove soft-deactivates instead of deleting", async () => {
    repo.findByIdInOrg.mockResolvedValue(row)

    await service.remove(orgId, row.id)

    expect(repo.update).toHaveBeenCalledWith(orgId, row.id, { isActive: false })
  })
})
