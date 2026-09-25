import { NotFoundException } from "@nestjs/common"
import { ScheduleEventsService } from "./schedule-events.service"
import type { ScheduleEventsRepository } from "./schedule-events.repository"

function makeRepo(): jest.Mocked<ScheduleEventsRepository> {
  return {
    listByOrg: jest.fn(),
    findByIdInOrg: jest.fn(),
    instancesWithTypeByEventIds: jest.fn(),
    assignmentsWithMemberByInstanceIds: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  } as unknown as jest.Mocked<ScheduleEventsRepository>
}

const orgId = "org-1"
const eventRow = { id: "e1", orgId, date: "2026-01-04", scriptureRef: "John 3:16", theme: "Grace", createdAt: new Date() }

describe("ScheduleEventsService", () => {
  let repo: jest.Mocked<ScheduleEventsRepository>
  let service: ScheduleEventsService

  beforeEach(() => {
    repo = makeRepo()
    service = new ScheduleEventsService(repo)
  })

  describe("list", () => {
    it("returns [] without extra queries when the org has no events", async () => {
      repo.listByOrg.mockResolvedValue([])

      const result = await service.list(orgId)

      expect(result).toEqual([])
      expect(repo.instancesWithTypeByEventIds).not.toHaveBeenCalled()
    })

    it("nests instances (sorted) and their assignments (sorted) per event", async () => {
      repo.listByOrg.mockResolvedValue([eventRow])
      repo.instancesWithTypeByEventIds.mockResolvedValue([
        {
          instance: { id: "si1", eventId: "e1", instanceTypeId: "it1", sortOrder: 1 },
          instanceType: { id: "it1", orgId, name: "Worship", sortOrder: 1, isActive: true, createdAt: new Date() },
        },
      ] as any)
      repo.assignmentsWithMemberByInstanceIds.mockResolvedValue([
        {
          assignment: { id: "ra1", serviceInstanceId: "si1", roleTemplateId: "rt1", memberId: "m1", freeText: "", sortOrder: 2 },
          member: { id: "m1", name: "Jo" },
        },
        {
          assignment: { id: "ra2", serviceInstanceId: "si1", roleTemplateId: "rt2", memberId: null, freeText: "TBD", sortOrder: 1 },
          member: null,
        },
      ] as any)

      const result = await service.list(orgId)

      expect(result[0].instances[0].assignments.map((a: any) => a.id)).toEqual(["ra2", "ra1"])
      expect(result[0].instances[0].assignments[1].member).toEqual({ id: "m1", name: "Jo" })
    })
  })

  describe("detail", () => {
    it("404s on unknown event", async () => {
      repo.findByIdInOrg.mockResolvedValue(undefined as any)

      await expect(service.detail(orgId, "missing")).rejects.toThrow(NotFoundException)
    })
  })

  describe("remove", () => {
    it("404s before deleting an unknown event", async () => {
      repo.findByIdInOrg.mockResolvedValue(undefined as any)

      await expect(service.remove(orgId, "missing")).rejects.toThrow(NotFoundException)
      expect(repo.delete).not.toHaveBeenCalled()
    })
  })
})
