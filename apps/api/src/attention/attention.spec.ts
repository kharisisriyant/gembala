import { ScopeService } from "../authz/scope.service"
import { absenceItems, birthdaysWithin, daysUntilBirthday } from "./attention"
import { AttentionService } from "./attention.service"

const sess = (date: string, presentIds: string[]) => ({ date, presentIds })
const group = { id: "g1", name: "Youth", members: [{ id: "a", name: "Andi" }, { id: "b", name: "Budi" }, { id: "c", name: "Cici" }] }

describe("absenceItems", () => {
  const sessions = new Map([["g1", [sess("2026-11-01", ["c"]), sess("2026-11-08", ["c"]), sess("2026-10-25", ["a", "c"]), sess("2026-10-18", ["a", "b", "c"])]]])
  const all = new Set(["a", "b", "c"])

  it("flags a streak of missed sessions >= threshold and reports last seen", () => {
    const items = absenceItems([group], sessions, all)
    expect(items.map((i) => [i.memberId, i.missed, i.lastSeen])).toEqual([
      ["a", 2, "2026-10-25"],
      ["b", 3, "2026-10-18"],
    ])
  })

  it("ignores members the viewer cannot see", () => {
    expect(absenceItems([group], sessions, new Set(["a"])).map((i) => i.memberId)).toEqual(["a"])
  })

  it("needs at least threshold sessions", () => {
    expect(absenceItems([group], new Map([["g1", [sess("2026-11-08", [])]]]), all)).toEqual([])
  })

  it("skips dormant groups when asked, but not by default", () => {
    const old = new Map([["g1", [sess("2026-01-08", []), sess("2026-01-01", [])]]])
    expect(absenceItems([group], old, all)).toHaveLength(3)
    expect(absenceItems([group], old, all, { asOf: "2026-11-09", dormantAfterDays: 60 })).toEqual([])
  })
})

describe("birthdays", () => {
  it("counts days to the next occurrence, across a year boundary", () => {
    expect(daysUntilBirthday("1990-12-30", "2026-12-28")).toBe(2)
    expect(daysUntilBirthday("1990-01-02", "2026-12-28")).toBe(5)
    expect(daysUntilBirthday("1990-11-09", "2026-11-09")).toBe(0)
  })

  it("lists only the next 7 days, soonest first", () => {
    const members = [
      { id: "1", name: "Late", dateOfBirth: "1990-11-16" }, // day 7: outside
      { id: "2", name: "Sat", dateOfBirth: "1990-11-14" },
      { id: "3", name: "Mon", dateOfBirth: "1990-11-09" },
      { id: "4", name: "None", dateOfBirth: null },
    ]
    expect(birthdaysWithin(members, "2026-11-09", 7).map((b) => [b.name, b.daysUntil, b.date])).toEqual([
      ["Mon", 0, "2026-11-09"],
      ["Sat", 5, "2026-11-14"],
    ])
  })
})

describe("AttentionService", () => {
  const scope = new ScopeService({
    orgTags: jest.fn().mockResolvedValue([
      { id: "t1", name: "youth", parentId: null, description: null },
      { id: "t2", name: "worship", parentId: null, description: null },
    ]),
  } as any)
  const leader = { orgId: "o", userId: "u1", scopeTagNames: ["youth"] } as any
  const m = (id: string, name: string, tags: string[], over = {}) => ({ id, name, tags, status: "active", dateOfBirth: null, ...over })

  const build = (care: any[] = []) => {
    const members = { orgMembersWithTags: jest.fn().mockResolvedValue([m("a", "Andi", ["youth"]), m("w", "Wati", ["worship"]), m("n", "Nina", ["youth"])]) }
    const groups = {
      list: jest.fn().mockResolvedValue([{ id: "g1", name: "Mixed", members: [{ id: "a", name: "Andi" }, { id: "w", name: "Wati" }] }]),
      sessionsForGroup: jest.fn().mockResolvedValue([sess("2026-11-08", []), sess("2026-11-01", [])]),
    }
    const journey = { pipeline: jest.fn().mockResolvedValue([{ memberId: "n", memberName: "Nina", daysSince: 20 }, { memberId: "w", memberName: "Wati", daysSince: 9 }]) }
    const stages = { list: jest.fn().mockResolvedValue([{ id: "s1", name: "Newcomer", rule: "newcomer_followup", active: true }]) }
    return new AttentionService(scope, members as any, groups as any, { list: jest.fn().mockResolvedValue(care) } as any, journey as any, stages as any)
  }

  it("never reports a member outside the viewer's scope (scope-leak guard)", async () => {
    const res = await build().forUser(leader, "2026-11-09")
    expect(res.absent.map((a) => a.memberId)).toEqual(["a"])
    expect(res.absent.some((a) => a.name === "Wati")).toBe(false)
  })

  it("shows a person once, under the highest-priority section", async () => {
    const care = [{ id: "r1", memberId: "a", memberName: "Andi", type: "care", createdAt: "2026-10-28T00:00:00Z", dueAt: "2026-11-05" }]
    const res = await build(care).forUser(leader, "2026-11-09")
    expect(res.care).toEqual([expect.objectContaining({ memberId: "a", daysOpen: 12, overdueDays: 4, alsoAbsentMissed: 2 })])
    expect(res.absent).toEqual([])
  })
})
