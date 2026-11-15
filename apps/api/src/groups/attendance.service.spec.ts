import { BadRequestException, NotFoundException } from "@nestjs/common"
import { AttendanceService } from "./attendance.service"
import type { AttendanceRepository } from "./attendance.repository"
import type { GroupsService } from "./groups.service"
import type { Db } from "../db/drizzle.module"

function makeRepo(): jest.Mocked<AttendanceRepository> {
  return {
    groupMemberIds: jest.fn(),
    insertSession: jest.fn(),
    insertAttendance: jest.fn(),
    findSessionInGroup: jest.fn(),
    attendanceRows: jest.fn(),
    updateSession: jest.fn(),
    replaceAttendance: jest.fn(),
    deleteSession: jest.fn(),
  } as unknown as jest.Mocked<AttendanceRepository>
}

const auth = { orgId: "org-1" } as any

const sessionRow = {
  id: "s1",
  orgId: "org-1",
  groupId: "g1",
  date: "2026-01-01",
  topic: "Bible study",
  prayerNotes: "",
}

describe("AttendanceService", () => {
  let attendance: jest.Mocked<AttendanceRepository>
  let groups: jest.Mocked<GroupsService>
  let db: jest.Mocked<Db>
  let service: AttendanceService

  beforeEach(() => {
    attendance = makeRepo()
    groups = { requireVisibleGroup: jest.fn().mockResolvedValue({}) } as any
    db = { transaction: jest.fn((cb: any) => cb(db)) } as any
    service = new AttendanceService(db, attendance, groups)
    attendance.groupMemberIds.mockResolvedValue([{ memberId: "m1" }, { memberId: "m2" }, { memberId: "m3" }] as any)
  })

  describe("logSession", () => {
    it("checks group visibility before anything else", async () => {
      groups.requireVisibleGroup.mockRejectedValue(new Error("not visible"))

      await expect(
        service.logSession(auth, "g1", { date: "2026-01-01", topic: "", prayerNotes: "", presentIds: [], excused: [] }),
      ).rejects.toThrow("not visible")
      expect(attendance.groupMemberIds).not.toHaveBeenCalled()
    })

    it("rejects presentIds that aren't in the group's roster", async () => {
      await expect(
        service.logSession(auth, "g1", {
          date: "2026-01-01",
          topic: "",
          prayerNotes: "",
          presentIds: ["m1", "outsider"],
          excused: [],
        }),
      ).rejects.toThrow(BadRequestException)
      expect(attendance.insertSession).not.toHaveBeenCalled()
    })

    it("rejects excused members who aren't in the group's roster", async () => {
      await expect(
        service.logSession(auth, "g1", {
          date: "2026-01-01",
          topic: "",
          prayerNotes: "",
          presentIds: ["m1"],
          excused: [{ memberId: "outsider", reason: "" }],
        }),
      ).rejects.toThrow("presentIds and excused must all be members of the group")
      expect(attendance.insertSession).not.toHaveBeenCalled()
    })

    it("rejects a member who is both present and excused", async () => {
      await expect(
        service.logSession(auth, "g1", {
          date: "2026-01-01",
          topic: "",
          prayerNotes: "",
          presentIds: ["m1"],
          excused: [{ memberId: "m1", reason: "sick" }],
        }),
      ).rejects.toThrow("a member cannot be both present and excused")
      expect(attendance.insertSession).not.toHaveBeenCalled()
    })

    it("rejects a member listed twice", async () => {
      await expect(
        service.logSession(auth, "g1", {
          date: "2026-01-01",
          topic: "",
          prayerNotes: "",
          presentIds: ["m1", "m1"],
          excused: [],
        }),
      ).rejects.toThrow(BadRequestException)
    })

    it("inserts the session with present and excused rows inside a transaction", async () => {
      attendance.insertSession.mockResolvedValue(sessionRow as any)

      const result = await service.logSession(auth, "g1", {
        date: "2026-01-01",
        topic: "Bible study",
        prayerNotes: "",
        presentIds: ["m1"],
        excused: [{ memberId: "m2", reason: "sick" }],
      })

      expect(db.transaction).toHaveBeenCalled()
      expect(attendance.insertAttendance).toHaveBeenCalledWith(
        "s1",
        [
          { memberId: "m1", status: "present", reason: "" },
          { memberId: "m2", status: "excused", reason: "sick" },
        ],
        db,
      )
      expect(result.presentIds).toEqual(["m1"])
      expect(result.excused).toEqual([{ memberId: "m2", reason: "sick" }])
    })
  })

  describe("updateSession", () => {
    beforeEach(() => {
      attendance.findSessionInGroup.mockResolvedValue(sessionRow as any)
      attendance.attendanceRows.mockResolvedValue([
        { memberId: "m1", status: "present", reason: "" },
        { memberId: "m2", status: "excused", reason: "travel" },
      ] as any)
    })

    it("404s when the session is not in this group/org", async () => {
      attendance.findSessionInGroup.mockResolvedValue(undefined)

      await expect(service.updateSession(auth, "g1", "s-other", { topic: "x" })).rejects.toThrow(NotFoundException)
      expect(attendance.findSessionInGroup).toHaveBeenCalledWith("org-1", "g1", "s-other")
      expect(attendance.updateSession).not.toHaveBeenCalled()
    })

    it("checks group scope before looking up the session", async () => {
      groups.requireVisibleGroup.mockRejectedValue(new Error("outside scope"))

      await expect(service.updateSession(auth, "g1", "s1", { topic: "x" })).rejects.toThrow("outside scope")
      expect(attendance.findSessionInGroup).not.toHaveBeenCalled()
    })

    it("updates only the fields given and keeps attendance when no list is sent", async () => {
      attendance.updateSession.mockResolvedValue({ ...sessionRow, topic: "Romans 5" } as any)

      const result = await service.updateSession(auth, "g1", "s1", { topic: "Romans 5" })

      expect(attendance.updateSession).toHaveBeenCalledWith("s1", { topic: "Romans 5" }, db)
      expect(attendance.replaceAttendance).not.toHaveBeenCalled()
      expect(result).toEqual({
        id: "s1",
        groupId: "g1",
        date: "2026-01-01",
        topic: "Romans 5",
        prayerNotes: "",
        presentIds: ["m1"],
        excused: [{ memberId: "m2", reason: "travel" }],
      })
    })

    it("replaces the attendance set, keeping the omitted list's current value", async () => {
      attendance.updateSession.mockResolvedValue(sessionRow as any)

      const result = await service.updateSession(auth, "g1", "s1", { presentIds: ["m1", "m3"] })

      expect(attendance.replaceAttendance).toHaveBeenCalledWith(
        "s1",
        [
          { memberId: "m1", status: "present", reason: "" },
          { memberId: "m3", status: "present", reason: "" },
          { memberId: "m2", status: "excused", reason: "travel" },
        ],
        db,
      )
      expect(result.presentIds).toEqual(["m1", "m3"])
      expect(result.excused).toEqual([{ memberId: "m2", reason: "travel" }])
    })

    it("rejects an update that makes a member both present and excused", async () => {
      await expect(
        service.updateSession(auth, "g1", "s1", { excused: [{ memberId: "m1", reason: "" }] }),
      ).rejects.toThrow("a member cannot be both present and excused")
      expect(attendance.updateSession).not.toHaveBeenCalled()
    })

    it("lets a member who has left the roster keep the mark already recorded", async () => {
      attendance.groupMemberIds.mockResolvedValue([{ memberId: "m1" }] as any)
      attendance.updateSession.mockResolvedValue(sessionRow as any)

      const result = await service.updateSession(auth, "g1", "s1", {
        presentIds: ["m1"],
        excused: [{ memberId: "m2", reason: "travel" }],
      })

      expect(result.excused).toEqual([{ memberId: "m2", reason: "travel" }])
    })

    it("rejects excused ids outside the roster", async () => {
      await expect(
        service.updateSession(auth, "g1", "s1", { presentIds: [], excused: [{ memberId: "outsider", reason: "" }] }),
      ).rejects.toThrow(BadRequestException)
      expect(attendance.replaceAttendance).not.toHaveBeenCalled()
    })
  })

  describe("deleteSession", () => {
    it("deletes a session that belongs to the group", async () => {
      attendance.findSessionInGroup.mockResolvedValue(sessionRow as any)

      await service.deleteSession(auth, "g1", "s1")

      expect(groups.requireVisibleGroup).toHaveBeenCalledWith(auth, "g1")
      expect(attendance.deleteSession).toHaveBeenCalledWith("s1")
    })

    it("404s when the session is not in this group/org", async () => {
      attendance.findSessionInGroup.mockResolvedValue(undefined)

      await expect(service.deleteSession(auth, "g1", "s1")).rejects.toThrow(NotFoundException)
      expect(attendance.deleteSession).not.toHaveBeenCalled()
    })

    it("does nothing when the group is outside the caller's scope", async () => {
      groups.requireVisibleGroup.mockRejectedValue(new Error("outside scope"))

      await expect(service.deleteSession(auth, "g1", "s1")).rejects.toThrow("outside scope")
      expect(attendance.deleteSession).not.toHaveBeenCalled()
    })
  })
})
