import { NotFoundException } from "@nestjs/common"
import { addDays, todayInZone } from "@gembala/shared"
import { TelegramAgentService, clampDays } from "./telegram-agent.service"
import { TELEGRAM_TOOLS } from "./telegram-tools"
import type { AuthContext } from "../authz/auth-context"

const MEMBER_A = "11111111-1111-4111-8111-111111111111"
const MEMBER_B = "22222222-2222-4222-8222-222222222222"
const MEMBER_C = "33333333-3333-4333-8333-333333333333"
const GROUP_1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const GROUP_2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"

function makeAuth(permissions: string[] = [], isSystemAdmin = false): AuthContext {
  return {
    userId: "user-1",
    userName: "Leader",
    userEmail: "leader@example.com",
    orgId: "org-1",
    orgName: "Org",
    membershipId: "ms-1",
    roles: [],
    isSystemAdmin,
    permissions: new Set(permissions),
    scopeTagNames: ["youth"],
  }
}

const leader = makeAuth([
  "members:read",
  "groups:read",
  "groups:update",
  "care_requests:read",
  "care_requests:create",
])
const noCare = makeAuth(["members:read", "groups:read", "groups:update"])

function careResponse(overrides: Record<string, unknown> = {}) {
  return {
    id: "req-1",
    memberId: MEMBER_A,
    memberName: "Andi",
    type: "prayer",
    body: "Pray for his mother's surgery",
    status: "open",
    source: "leader",
    submittedBy: { id: "user-1", name: "Leader" },
    assignedTo: { id: "user-1", name: "Leader" },
    dueAt: "2026-11-20",
    overdue: false,
    closedAt: null,
    closedBy: null,
    closeNote: null,
    createdAt: "2026-11-10T03:00:00.000Z",
    updatedAt: "2026-11-10T03:00:00.000Z",
    ...overrides,
  }
}

describe("TelegramAgentService.dispatchTool", () => {
  let members: { list: jest.Mock; detail: jest.Mock; create: jest.Mock; orgMembersWithTags: jest.Mock }
  let groups: { list: jest.Mock; requireVisibleGroup: jest.Mock; sessionsForGroup: jest.Mock }
  let attendance: { logSession: jest.Mock }
  let scope: { expandedScope: jest.Mock; memberVisible: jest.Mock }
  let care: { list: jest.Mock; create: jest.Mock }
  let moduleRef: { get: jest.Mock }
  let agent: TelegramAgentService

  const call = async (auth: AuthContext, name: string, args: unknown = {}) =>
    JSON.parse(await agent.dispatchTool(auth, name, JSON.stringify(args)))

  beforeEach(() => {
    members = { list: jest.fn(), detail: jest.fn(), create: jest.fn(), orgMembersWithTags: jest.fn() }
    groups = { list: jest.fn(), requireVisibleGroup: jest.fn(), sessionsForGroup: jest.fn() }
    attendance = { logSession: jest.fn() }
    scope = {
      expandedScope: jest.fn().mockResolvedValue("scope"),
      // C is tagged outside the caller's scope.
      memberVisible: jest.fn((_s: unknown, tags: string[]) => !tags.includes("other")),
    }
    care = { list: jest.fn(), create: jest.fn() }
    moduleRef = { get: jest.fn().mockReturnValue(care) }
    const config = { get: jest.fn() }
    agent = new TelegramAgentService(
      config as any,
      members as any,
      groups as any,
      attendance as any,
      scope as any,
      moduleRef as any,
    )
  })

  it("advertises every dispatched tool", () => {
    expect(TELEGRAM_TOOLS.map((t) => t.function.name)).toEqual(
      expect.arrayContaining([
        "get_absence_report",
        "get_birthdays",
        "list_care_requests",
        "create_care_request",
        "log_session",
      ]),
    )
    expect(TELEGRAM_TOOLS.map((t) => t.function.name)).not.toContain("add_note")
  })

  describe("log_session", () => {
    it("maps excused entries and passes present ids through", async () => {
      attendance.logSession.mockResolvedValue({ id: "s-1" })
      await call(leader, "log_session", {
        group_id: GROUP_1,
        date: "2026-11-14",
        topic: "Psalm 23",
        present_member_ids: [MEMBER_A],
        excused: [{ member_id: MEMBER_B, reason: " sick " }, { member_id: MEMBER_C }],
      })
      expect(attendance.logSession).toHaveBeenCalledWith(leader, GROUP_1, {
        date: "2026-11-14",
        topic: "Psalm 23",
        prayerNotes: "",
        presentIds: [MEMBER_A],
        excused: [
          { memberId: MEMBER_B, reason: "sick" },
          { memberId: MEMBER_C, reason: "" },
        ],
      })
    })

    it("defaults excused to an empty list", async () => {
      attendance.logSession.mockResolvedValue({ id: "s-1" })
      await call(leader, "log_session", { group_id: GROUP_1, date: "2026-11-14", present_member_ids: [MEMBER_A] })
      expect(attendance.logSession.mock.calls[0][2].excused).toEqual([])
    })

    it("rejects an excused entry without a valid member id before calling the service", async () => {
      const res = await call(leader, "log_session", {
        group_id: GROUP_1,
        date: "2026-11-14",
        present_member_ids: [],
        excused: [{ reason: "sick" }],
      })
      expect(res.error).toMatch(/invalid arguments: excused\.0\.memberId/)
      expect(attendance.logSession).not.toHaveBeenCalled()
    })

    it("returns the service's both-present-and-excused error to the model", async () => {
      attendance.logSession.mockRejectedValue(new Error("a member cannot be both present and excused"))
      const res = await call(leader, "log_session", {
        group_id: GROUP_1,
        date: "2026-11-14",
        present_member_ids: [MEMBER_A],
        excused: [{ member_id: MEMBER_A }],
      })
      expect(res).toEqual({ error: "a member cannot be both present and excused" })
    })
  })

  describe("get_absence_report", () => {
    const session = (date: string, presentIds: string[], excused: { memberId: string; reason: string }[] = []) => ({
      id: date,
      groupId: GROUP_1,
      date,
      presentIds,
      excused,
      topic: "",
      prayerNotes: "",
    })

    beforeEach(() => {
      members.orgMembersWithTags.mockResolvedValue([
        { id: MEMBER_A, name: "Andi", tags: ["youth"] },
        { id: MEMBER_B, name: "Budi", tags: ["youth"] },
        { id: MEMBER_C, name: "Citra", tags: ["other"] },
      ])
      groups.list.mockResolvedValue([
        {
          id: GROUP_1,
          name: "Youth A",
          members: [
            { id: MEMBER_A, name: "Andi" },
            { id: MEMBER_B, name: "Budi" },
            { id: MEMBER_C, name: "Citra" },
          ],
        },
        { id: GROUP_2, name: "Youth B", members: [{ id: MEMBER_A, name: "Andi" }] },
      ])
      groups.sessionsForGroup.mockImplementation(async (id: string) =>
        id === GROUP_1
          ? [
              session("2026-11-14", [], [{ memberId: MEMBER_B, reason: "sick" }]),
              session("2026-11-07", []),
              session("2026-10-31", [MEMBER_A, MEMBER_B]),
            ]
          : [],
      )
    })

    it("flags visible members with 2+ consecutive misses, skipping excused sessions", async () => {
      const res = await call(leader, "get_absence_report")
      expect(res).toEqual({
        threshold: 2,
        count: 1,
        members: [
          {
            memberId: MEMBER_A,
            name: "Andi",
            groupId: GROUP_1,
            groupName: "Youth A",
            missedSessions: 2,
            lastSeen: "2026-10-31",
          },
        ],
      })
    })

    it("filters by group after checking the group is visible", async () => {
      const res = await call(leader, "get_absence_report", { group_id: GROUP_2 })
      expect(groups.requireVisibleGroup).toHaveBeenCalledWith(leader, GROUP_2)
      expect(res.members).toEqual([])
      expect(groups.sessionsForGroup).not.toHaveBeenCalledWith(GROUP_1)
    })

    it("returns not-found for an out-of-scope group", async () => {
      groups.requireVisibleGroup.mockRejectedValue(new NotFoundException("group not found"))
      expect(await call(leader, "get_absence_report", { group_id: GROUP_2 })).toEqual({ error: "group not found" })
    })

    it("requires groups:read", async () => {
      const res = await call(makeAuth(["members:read"]), "get_absence_report")
      expect(res).toEqual({ error: "missing permission: groups:read" })
      expect(groups.list).not.toHaveBeenCalled()
    })
  })

  describe("get_birthdays", () => {
    const today = todayInZone()
    const dob = (daysAhead: number) => `1990${addDays(today, daysAhead).slice(4)}`

    beforeEach(() => {
      members.orgMembersWithTags.mockResolvedValue([
        { id: MEMBER_A, name: "Andi", tags: ["youth"], dateOfBirth: dob(3) },
        { id: MEMBER_B, name: "Budi", tags: ["youth"], dateOfBirth: dob(20) },
        { id: MEMBER_C, name: "Citra", tags: ["other"], dateOfBirth: dob(1) },
      ])
    })

    it("defaults to 7 days and only returns visible members", async () => {
      const res = await call(leader, "get_birthdays")
      expect(res.days).toBe(7)
      expect(res.today).toBe(today)
      expect(res.birthdays.map((b: { name: string }) => b.name)).toEqual(["Andi"])
      expect(res.birthdays[0]).toMatchObject({ memberId: MEMBER_A, daysUntil: 3, date: addDays(today, 3) })
    })

    it("widens the window when asked", async () => {
      const res = await call(leader, "get_birthdays", { days: 30 })
      expect(res.birthdays.map((b: { name: string }) => b.name)).toEqual(["Andi", "Budi"])
    })

    it("clamps days to 1..60 and falls back to 7 on junk", () => {
      expect(clampDays(undefined)).toBe(7)
      expect(clampDays("abc")).toBe(7)
      expect(clampDays(0)).toBe(1)
      expect(clampDays(-5)).toBe(1)
      expect(clampDays(365)).toBe(60)
      expect(clampDays("14")).toBe(14)
      expect(clampDays(2.6)).toBe(3)
    })

    it("reports the clamped window back to the model", async () => {
      expect((await call(leader, "get_birthdays", { days: 999 })).days).toBe(60)
    })

    it("requires members:read", async () => {
      const res = await call(makeAuth(["groups:read"]), "get_birthdays")
      expect(res).toEqual({ error: "missing permission: members:read" })
    })
  })

  describe("list_care_requests", () => {
    it("defaults to open requests and summarises each one", async () => {
      care.list.mockResolvedValue([careResponse({ overdue: true, body: "x".repeat(400) })])
      const res = await call(leader, "list_care_requests")
      expect(moduleRef.get).toHaveBeenCalled()
      expect(care.list).toHaveBeenCalledWith(leader, { status: "open" })
      expect(res.total).toBe(1)
      expect(res.requests[0]).toEqual({
        id: "req-1",
        memberId: MEMBER_A,
        memberName: "Andi",
        type: "prayer",
        status: "open",
        summary: `${"x".repeat(280)}…`,
        owner: "Leader",
        dueAt: "2026-11-20",
        overdue: true,
        createdAt: "2026-11-10",
      })
    })

    it("maps the optional filters onto the service query", async () => {
      care.list.mockResolvedValue([])
      await call(leader, "list_care_requests", {
        status: "all",
        type: "care",
        member_id: MEMBER_B,
        assigned_to_me: true,
        overdue_only: true,
      })
      expect(care.list).toHaveBeenCalledWith(leader, {
        type: "care",
        memberId: MEMBER_B,
        assignedToUserId: "me",
        overdue: true,
      })
    })

    it("rejects invalid filters", async () => {
      const res = await call(leader, "list_care_requests", { status: "pending", member_id: "Andi" })
      expect(res.error).toMatch(/^invalid arguments: status: .*; member_id: Invalid uuid/)
      expect(care.list).not.toHaveBeenCalled()
    })

    it("requires care_requests:read", async () => {
      const res = await call(noCare, "list_care_requests")
      expect(res).toEqual({ error: "missing permission: care_requests:read" })
      expect(care.list).not.toHaveBeenCalled()
    })

    it("lets a system admin through without explicit permissions", async () => {
      care.list.mockResolvedValue([])
      const res = await call(makeAuth([], true), "list_care_requests")
      expect(res).toEqual({ total: 0, shown: 0, requests: [] })
    })
  })

  describe("create_care_request", () => {
    it("creates through the service with the shared create schema", async () => {
      care.create.mockResolvedValue(careResponse())
      const res = await call(leader, "create_care_request", {
        member_id: MEMBER_A,
        type: "prayer",
        body: "  Pray for his mother's surgery  ",
        due_at: "2026-11-20",
      })
      expect(care.create).toHaveBeenCalledWith(leader, {
        memberId: MEMBER_A,
        type: "prayer",
        body: "Pray for his mother's surgery",
        dueAt: "2026-11-20",
      })
      expect(res).toMatchObject({ id: "req-1", memberName: "Andi", owner: "Leader" })
    })

    it("leaves the due date to the service default when omitted", async () => {
      care.create.mockResolvedValue(careResponse())
      await call(leader, "create_care_request", { member_id: MEMBER_A, type: "care", body: "Hospital visit" })
      expect(care.create.mock.calls[0][1]).toEqual({ memberId: MEMBER_A, type: "care", body: "Hospital visit" })
    })

    it("rejects a member name instead of a UUID, an empty body and a bad type", async () => {
      const res = await call(leader, "create_care_request", { member_id: "Andi", type: "visit", body: " " })
      expect(res.error).toMatch(/memberId: Invalid uuid/)
      expect(res.error).toMatch(/type: /)
      expect(res.error).toMatch(/body: body is required/)
      expect(care.create).not.toHaveBeenCalled()
    })

    it("requires care_requests:create", async () => {
      const readOnly = makeAuth(["members:read", "care_requests:read"])
      const res = await call(readOnly, "create_care_request", { member_id: MEMBER_A, type: "prayer", body: "x" })
      expect(res).toEqual({ error: "missing permission: care_requests:create" })
      expect(care.create).not.toHaveBeenCalled()
    })

    it("returns the service's out-of-scope error to the model", async () => {
      care.create.mockRejectedValue(new NotFoundException("member not found"))
      const res = await call(leader, "create_care_request", { member_id: MEMBER_C, type: "prayer", body: "x" })
      expect(res).toEqual({ error: "member not found" })
    })
  })
})
