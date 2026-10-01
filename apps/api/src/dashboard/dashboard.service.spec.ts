import { DashboardService } from "./dashboard.service"
import type { ScopeService } from "../authz/scope.service"
import type { MembersService } from "../members/members.service"
import type { GroupsService } from "../groups/groups.service"

const auth = { orgId: "org-1" } as any

describe("DashboardService", () => {
  it("returns birthdays and actionable small-group follow-up signals in the caller's scope", async () => {
    const today = new Date()
    const birthdayToday = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, "0"), String(today.getDate()).padStart(2, "0")].join("-")
    const members = [
      { id: "m1", name: "Birthday", photoUrl: "", dateOfBirth: birthdayToday, status: "active", tags: ["youth"] },
      { id: "m2", name: "Absent", photoUrl: "", dateOfBirth: null, status: "active", tags: ["youth"] },
      { id: "m3", name: "Ungrouped", photoUrl: "", dateOfBirth: null, status: "newcomer", tags: ["youth"] },
      { id: "m4", name: "Inactive", photoUrl: "", dateOfBirth: null, status: "inactive", tags: ["youth"] },
    ]
    const scope = { expandedScope: jest.fn().mockResolvedValue({}), memberVisible: jest.fn().mockReturnValue(true) } as any as jest.Mocked<ScopeService>
    const membersService = { orgMembersWithTags: jest.fn().mockResolvedValue(members) } as any as jest.Mocked<MembersService>
    const groups = {
      list: jest.fn().mockResolvedValue([{ id: "g1", name: "Youth", members: [{ id: "m1", name: "Birthday" }, { id: "m2", name: "Absent" }] }]),
      sessionsForGroup: jest.fn().mockResolvedValue([
        { id: "s3", groupId: "g1", date: "2026-03-03", presentIds: ["m1"], topic: "", prayerNotes: "" },
        { id: "s2", groupId: "g1", date: "2026-02-24", presentIds: ["m1"], topic: "", prayerNotes: "" },
        { id: "s1", groupId: "g1", date: "2026-02-17", presentIds: ["m1"], topic: "", prayerNotes: "" },
      ]),
    } as any as jest.Mocked<GroupsService>
    const service = new DashboardService(scope, membersService, groups)

    const result = await service.summary(auth)

    expect(result.upcomingBirthdays).toEqual([expect.objectContaining({ memberId: "m1", daysUntil: 0 })])
    expect(result.membersWithoutGroup.map((member) => member.memberId)).toEqual(["m3"])
    expect(result.attendanceAlerts).toEqual([
      expect.objectContaining({ memberId: "m2", groupId: "g1", missedMeetings: 3 }),
    ])
  })
})
