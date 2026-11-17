import { OVERDUE_MILESTONES, RemindersService } from "./reminders.service"

const TODAY = "2026-11-12"
const careRow = (over = {}) => ({ id: "r1", orgId: "o1", memberId: "m1", memberName: "Jo", type: "care" as const, assignedToId: "u1", dueAt: "2026-11-12", ...over })

function setup(opts: { care?: any[]; users?: string[]; items?: any; auth?: any } = {}) {
  const repo = {
    openOwnedWithDueDate: jest.fn().mockResolvedValue(opts.care ?? []),
    activeUserIds: jest.fn().mockResolvedValue((opts.users ?? []).map((userId) => ({ userId }))),
  }
  const attention = { forUser: jest.fn().mockResolvedValue(opts.items ?? { absent: [], newcomers: [] }) }
  const authContext = { load: jest.fn().mockResolvedValue("auth" in opts ? opts.auth : { orgId: "o1" }) }
  const notifications = { notify: jest.fn().mockResolvedValue(true) }
  return { service: new RemindersService(repo as any, attention as any, authContext as any, notifications as any), notifications, attention }
}

describe("RemindersService.runCare", () => {
  it("reminds the owner on the due date and the day before", async () => {
    const { service, notifications } = setup({ care: [careRow({ id: "a", dueAt: "2026-11-12" }), careRow({ id: "b", dueAt: "2026-11-13" }), careRow({ id: "c", dueAt: "2026-11-20" })] })
    expect(await service.runCare(TODAY)).toBe(2)
    expect(notifications.notify.mock.calls.map((c) => [c[0].type, c[0].payload.daysLeft, c[0].idempotencyKey])).toEqual([
      ["care_request.due_soon", 0, "care_due_soon:a:2026-11-12:0"],
      ["care_request.due_soon", 1, "care_due_soon:b:2026-11-13:1"],
    ])
    expect(notifications.notify.mock.calls[0][0]).toMatchObject({ orgId: "o1", recipients: ["u1"] })
  })

  it.each(OVERDUE_MILESTONES)("sends an overdue reminder on day %i", async (days) => {
    const due = new Date(Date.UTC(2026, 10, 12 - days)).toISOString().slice(0, 10)
    const { service, notifications } = setup({ care: [careRow({ dueAt: due })] })
    await service.runCare(TODAY)
    expect(notifications.notify).toHaveBeenCalledWith(expect.objectContaining({ type: "care_request.overdue", payload: expect.objectContaining({ overdueDays: days }), idempotencyKey: `care_overdue:r1:${days}` }))
  })

  it("stays quiet between milestones", async () => {
    const { service, notifications } = setup({ care: [careRow({ dueAt: "2026-11-09" })] }) // 3 days overdue
    expect(await service.runCare(TODAY)).toBe(0)
    expect(notifications.notify).not.toHaveBeenCalled()
  })

  it("counts only newly queued reminders (reruns are deduped by key)", async () => {
    const { service, notifications } = setup({ care: [careRow()] })
    notifications.notify.mockResolvedValue(false) // idempotency key already used
    expect(await service.runCare(TODAY)).toBe(0)
  })

  it("keeps going when one reminder fails", async () => {
    const { service, notifications } = setup({ care: [careRow({ id: "a" }), careRow({ id: "b" })] })
    notifications.notify.mockRejectedValueOnce(new Error("boom")).mockResolvedValue(true)
    expect(await service.runCare(TODAY)).toBe(1)
  })
})

describe("RemindersService.runAttention", () => {
  const items = {
    absent: [{ memberId: "m1", name: "Jo", groupId: "g1", groupName: "Youth", missed: 3, lastSeen: null }],
    newcomers: [{ memberId: "m2", name: "Ann", daysSince: 5 }],
  }

  it("notifies each user about their own absent members and newcomers", async () => {
    const { service, notifications, attention } = setup({ users: ["u1"], items })
    expect(await service.runAttention(TODAY)).toBe(2)
    expect(attention.forUser).toHaveBeenCalledWith({ orgId: "o1" }, TODAY)
    const keys = notifications.notify.mock.calls.map((c) => c[0].idempotencyKey)
    expect(keys).toEqual(["absence:u1:m1:3", "newcomer:u1:m2:2026-11-09"]) // Monday of that week
    expect(notifications.notify.mock.calls[0][0]).toMatchObject({ type: "attention.absence_streak", recipients: ["u1"], payload: { groupId: "g1", missed: 3 } })
  })

  it("skips users that no longer resolve and survives per-user failures", async () => {
    const gone = setup({ users: ["u1"], items, auth: null })
    expect(await gone.service.runAttention(TODAY)).toBe(0)

    const { service, attention } = setup({ users: ["u1", "u2"], items })
    attention.forUser.mockRejectedValueOnce(new Error("scope exploded"))
    expect(await service.runAttention(TODAY)).toBe(2) // u2 still processed
  })
})
