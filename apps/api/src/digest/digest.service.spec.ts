import { DigestService, weekStartOf } from "./digest.service"

const empty = { care: [], absent: [], newcomers: [], nextStep: [], birthdays: [] }
const busy = { ...empty, care: [{ requestId: "r", memberId: "m", memberName: "Budi", type: "care", daysOpen: 3, overdueDays: 0, alsoAbsentMissed: null }] }
const leaderAuth = { userId: "u1", userName: "Andrew", orgId: "o", isSystemAdmin: false } as any
const adminAuth = { ...leaderAuth, userId: "u0", isSystemAdmin: true }
const recipient = (over = {}) => ({ userId: "u1", orgId: "o", name: "Andrew", email: "a@x.test", enabled: true, locale: "en" as const, ...over })
const NOW = new Date("2026-11-08T23:30:00Z") // Mon 9 Nov 06:30 in Jakarta

function setup(opts: { items?: any; telegram?: boolean; claim?: boolean; recipients?: any[] } = {}) {
  const repo = {
    recipients: jest.fn().mockResolvedValue(opts.recipients ?? [recipient()]),
    claim: jest.fn().mockResolvedValue(opts.claim ?? true),
    markSent: jest.fn(),
    markFailed: jest.fn(),
    findPreferences: jest.fn().mockResolvedValue(undefined),
  }
  const attention = { forUser: jest.fn().mockResolvedValue(opts.items ?? busy) }
  const care = { openSummary: jest.fn().mockResolvedValue({ byOwner: [], unassigned: 0, ownerCannotSee: 0, longestOverdue: [] }) }
  const authContext = { load: jest.fn(async (id: string) => (id === "u0" ? adminAuth : leaderAuth)) }
  const telegram = { sendToUser: jest.fn().mockResolvedValue(opts.telegram ?? false) }
  const mail = { sendWeeklyDigest: jest.fn() }
  const config = { getOrThrow: jest.fn().mockReturnValue("https://app.test") }
  const service = new DigestService(repo as any, attention as any, care as any, authContext as any, telegram as any, mail as any, config as any)
  return { service, repo, attention, care, telegram, mail }
}

describe("weekStartOf", () => {
  it("returns the Monday of the week", () => {
    expect(weekStartOf("2026-11-09")).toBe("2026-11-09") // Monday
    expect(weekStartOf("2026-11-15")).toBe("2026-11-09") // Sunday
    expect(weekStartOf("2026-11-11")).toBe("2026-11-09")
  })
})

describe("DigestService.runWeekly", () => {
  it("uses the Jakarta date: Monday 06:30 local is still the same week's Monday", async () => {
    const { service, attention, repo } = setup()
    await service.runWeekly(NOW)
    expect(attention.forUser).toHaveBeenCalledWith(leaderAuth, "2026-11-09")
    expect(repo.claim).toHaveBeenCalledWith("u1", "2026-11-09")
  })

  it("sends by email when Telegram is not linked, and records it", async () => {
    const { service, mail, repo } = setup({ telegram: false })
    expect(await service.runWeekly(NOW)).toBe(1)
    expect(mail.sendWeeklyDigest).toHaveBeenCalledWith("a@x.test", expect.objectContaining({ subject: expect.any(String) }))
    expect(repo.markSent).toHaveBeenCalledWith("u1", "2026-11-09", "email")
  })

  it("prefers Telegram and does not also email", async () => {
    const { service, mail, repo } = setup({ telegram: true })
    await service.runWeekly(NOW)
    expect(mail.sendWeeklyDigest).not.toHaveBeenCalled()
    expect(repo.markSent).toHaveBeenCalledWith("u1", "2026-11-09", "telegram")
  })

  it("sends nothing and writes no log row when there is nothing to report", async () => {
    const { service, repo, mail, telegram } = setup({ items: empty })
    expect(await service.runWeekly(NOW)).toBe(0)
    expect(repo.claim).not.toHaveBeenCalled()
    expect(mail.sendWeeklyDigest).not.toHaveBeenCalled()
    expect(telegram.sendToUser).not.toHaveBeenCalled()
  })

  it("skips a week that was already sent or is being sent", async () => {
    const { service, mail, telegram } = setup({ claim: false })
    expect(await service.runWeekly(NOW)).toBe(0)
    expect(mail.sendWeeklyDigest).not.toHaveBeenCalled()
    expect(telegram.sendToUser).not.toHaveBeenCalled()
  })

  it("skips users who turned the digest off", async () => {
    const { service, attention } = setup({ recipients: [recipient({ enabled: false })] })
    await service.runWeekly(NOW)
    expect(attention.forUser).not.toHaveBeenCalled()
  })

  it("marks a failed delivery and keeps going with the next user", async () => {
    const { service, repo, mail } = setup({ recipients: [recipient(), recipient({ userId: "u2", email: "b@x.test" })] })
    mail.sendWeeklyDigest.mockRejectedValueOnce(new Error("resend down")).mockResolvedValueOnce(undefined)
    expect(await service.runWeekly(NOW)).toBe(1)
    expect(repo.markFailed).toHaveBeenCalledWith("u1", "2026-11-09", "resend down")
    expect(repo.markSent).toHaveBeenCalledWith("u2", "2026-11-09", "email")
  })

  it("gives admins the summary variant", async () => {
    const { service, care, mail } = setup({ recipients: [recipient({ userId: "u0" })], items: empty })
    care.openSummary.mockResolvedValue({ byOwner: [{ name: "Lea", open: 1, overdue: 1 }], unassigned: 0, ownerCannotSee: 0, longestOverdue: [] })
    await service.runWeekly(NOW)
    expect(care.openSummary).toHaveBeenCalledWith(adminAuth)
    expect(mail.sendWeeklyDigest).toHaveBeenCalledWith("a@x.test", expect.objectContaining({ text: expect.stringContaining("team summary") }))
  })
})

describe("DigestService.preview", () => {
  it("renders without sending and without claiming", async () => {
    const { service, repo, mail } = setup()
    const res = await service.preview(leaderAuth, NOW)
    expect(res).toMatchObject({ kind: "personal", empty: false })
    expect(res.text).toContain("Budi")
    expect(repo.claim).not.toHaveBeenCalled()
    expect(mail.sendWeeklyDigest).not.toHaveBeenCalled()
  })
})
