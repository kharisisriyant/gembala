import { ConflictException, NotFoundException } from "@nestjs/common"
import { EventsService } from "./events.service"
import type { EventsRepository } from "./events.repository"

function makeRepo(): jest.Mocked<EventsRepository> {
  return {
    findRoomInOrg: jest.fn(),
    findConflict: jest.fn(),
    listWithRoomByOrg: jest.fn(),
    findWithRoomInOrg: jest.fn(),
    findByIdInOrg: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  } as unknown as jest.Mocked<EventsRepository>
}

const orgId = "org-1"
const eventRow = {
  id: "e1",
  orgId,
  roomId: "room-1",
  title: "Sunday Service",
  description: "",
  startAt: new Date("2026-01-04T09:00:00Z"),
  endAt: new Date("2026-01-04T10:00:00Z"),
  isPublic: true,
  createdAt: new Date(),
}
const roomRow = { id: "room-1", orgId, name: "Main Hall", capacity: 100, description: "", isActive: true, createdAt: new Date() }

describe("EventsService", () => {
  let repo: jest.Mocked<EventsRepository>
  let service: EventsService

  beforeEach(() => {
    repo = makeRepo()
    service = new EventsService(repo)
  })

  describe("create", () => {
    it("404s when the room doesn't exist in this org", async () => {
      repo.findRoomInOrg.mockResolvedValue(undefined as any)

      await expect(
        service.create(orgId, { roomId: "missing", title: "x", startAt: new Date(), endAt: new Date() } as any),
      ).rejects.toThrow(NotFoundException)
      expect(repo.insert).not.toHaveBeenCalled()
    })

    it("rejects overlapping bookings in the same room", async () => {
      repo.findRoomInOrg.mockResolvedValue(roomRow as any)
      repo.findConflict.mockResolvedValue({ id: "e0", title: "Existing Meeting" } as any)

      await expect(
        service.create(orgId, {
          roomId: "room-1",
          title: "New Meeting",
          startAt: eventRow.startAt,
          endAt: eventRow.endAt,
        } as any),
      ).rejects.toThrow(ConflictException)
      expect(repo.insert).not.toHaveBeenCalled()
    })

    it("creates without room checks when no room is given", async () => {
      repo.insert.mockResolvedValue({ ...eventRow, roomId: null } as any)

      await service.create(orgId, {
        title: "Prayer Meeting",
        description: "",
        startAt: eventRow.startAt,
        endAt: eventRow.endAt,
        isPublic: false,
      } as any)

      expect(repo.findRoomInOrg).not.toHaveBeenCalled()
      expect(repo.insert).toHaveBeenCalledWith(expect.objectContaining({ roomId: null }))
    })
  })

  describe("update", () => {
    it("404s on unknown event", async () => {
      repo.findByIdInOrg.mockResolvedValue(undefined as any)

      await expect(service.update(orgId, "missing", {} as any)).rejects.toThrow(NotFoundException)
    })

    it("rejects end before start", async () => {
      repo.findByIdInOrg.mockResolvedValue(eventRow as any)

      await expect(
        service.update(orgId, eventRow.id, {
          startAt: new Date("2026-01-04T12:00:00Z"),
          endAt: new Date("2026-01-04T11:00:00Z"),
        } as any),
      ).rejects.toThrow(ConflictException)
    })

    it("re-checks room conflicts, excluding this event's own id", async () => {
      repo.findByIdInOrg.mockResolvedValue(eventRow as any)
      repo.findRoomInOrg.mockResolvedValue(roomRow as any)
      repo.findConflict.mockResolvedValue(undefined as any)
      repo.update.mockResolvedValue(eventRow as any)

      await service.update(orgId, eventRow.id, { title: "Renamed" } as any)

      expect(repo.findConflict).toHaveBeenCalledWith(
        orgId,
        "room-1",
        eventRow.startAt,
        eventRow.endAt,
        eventRow.id,
      )
    })
  })

  describe("remove", () => {
    it("404s on unknown event", async () => {
      repo.findByIdInOrg.mockResolvedValue(undefined as any)

      await expect(service.remove(orgId, "missing")).rejects.toThrow(NotFoundException)
      expect(repo.delete).not.toHaveBeenCalled()
    })

    it("deletes once existence is confirmed", async () => {
      repo.findByIdInOrg.mockResolvedValue(eventRow as any)

      await service.remove(orgId, eventRow.id)

      expect(repo.delete).toHaveBeenCalledWith(orgId, eventRow.id)
    })
  })

  describe("list", () => {
    it("sorts by start time", async () => {
      repo.listWithRoomByOrg.mockResolvedValue([
        { event: { ...eventRow, id: "e2", startAt: new Date("2026-01-05T09:00:00Z"), endAt: new Date("2026-01-05T10:00:00Z") }, room: null },
        { event: eventRow, room: roomRow },
      ] as any)

      const result = await service.list(orgId)

      expect(result.map((e) => e.id)).toEqual(["e1", "e2"])
      expect(result[0].room).toEqual({ id: "room-1", name: "Main Hall" })
    })
  })
})
