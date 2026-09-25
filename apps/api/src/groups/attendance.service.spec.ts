import { BadRequestException } from "@nestjs/common"
import { AttendanceService } from "./attendance.service"
import type { AttendanceRepository } from "./attendance.repository"
import type { GroupsService } from "./groups.service"
import type { Db } from "../db/drizzle.module"

function makeRepo(): jest.Mocked<AttendanceRepository> {
  return {
    groupMemberIds: jest.fn(),
    insertSession: jest.fn(),
    insertAttendance: jest.fn(),
  } as unknown as jest.Mocked<AttendanceRepository>
}

const auth = { orgId: "org-1" } as any

describe("AttendanceService", () => {
  let attendance: jest.Mocked<AttendanceRepository>
  let groups: jest.Mocked<GroupsService>
  let db: jest.Mocked<Db>
  let service: AttendanceService

  beforeEach(() => {
    attendance = makeRepo()
    groups = { requireVisibleGroup: jest.fn() } as any
    db = { transaction: jest.fn((cb: any) => cb(db)) } as any
    service = new AttendanceService(db, attendance, groups)
  })

  it("checks group visibility before anything else", async () => {
    groups.requireVisibleGroup.mockRejectedValue(new Error("not visible"))

    await expect(
      service.logSession(auth, "g1", { date: "2026-01-01", topic: "", prayerNotes: "", presentIds: [] } as any),
    ).rejects.toThrow("not visible")
    expect(attendance.groupMemberIds).not.toHaveBeenCalled()
  })

  it("rejects presentIds that aren't in the group's roster", async () => {
    groups.requireVisibleGroup.mockResolvedValue({} as any)
    attendance.groupMemberIds.mockResolvedValue([{ memberId: "m1" }] as any)

    await expect(
      service.logSession(auth, "g1", {
        date: "2026-01-01",
        topic: "",
        prayerNotes: "",
        presentIds: ["m1", "outsider"],
      } as any),
    ).rejects.toThrow(BadRequestException)
    expect(attendance.insertSession).not.toHaveBeenCalled()
  })

  it("inserts the session and attendance rows inside a transaction", async () => {
    groups.requireVisibleGroup.mockResolvedValue({} as any)
    attendance.groupMemberIds.mockResolvedValue([{ memberId: "m1" }, { memberId: "m2" }] as any)
    attendance.insertSession.mockResolvedValue({
      id: "s1",
      groupId: "g1",
      date: "2026-01-01",
      topic: "Bible study",
      prayerNotes: "",
    } as any)

    const result = await service.logSession(auth, "g1", {
      date: "2026-01-01",
      topic: "Bible study",
      prayerNotes: "",
      presentIds: ["m1"],
    } as any)

    expect(db.transaction).toHaveBeenCalled()
    expect(attendance.insertAttendance).toHaveBeenCalledWith("s1", ["m1"], db)
    expect(result.presentIds).toEqual(["m1"])
  })
})
