import { DeliveryProcessor } from "./notifications.processor"

const NOW = new Date("2026-11-12T10:00:00Z")
const ctx = (over: { delivery?: any; notification?: any } = {}) => ({
  payload: { memberId: "m1" },
  delivery: { id: "d1", channel: "telegram", status: "queued", correlationId: "c1", ...over.delivery },
  notification: { id: "n1", orgId: "o", userId: "u", typeKey: "t", category: "activity", title: "T", body: "B", link: "/x", expiresAt: new Date("2026-11-12T11:00:00Z"), ...over.notification },
})

function setup(opts: { ctx?: any; switches?: any[]; users?: any[]; overrides?: any[]; available?: boolean; result?: any; allowed?: boolean } = {}) {
  const repo = {
    deliveryContext: jest.fn().mockResolvedValue(opts.ctx === undefined ? ctx() : opts.ctx),
    killSwitches: jest.fn().mockResolvedValue(opts.switches ?? []),
    routingUsers: jest.fn().mockResolvedValue(opts.users ?? [{ userId: "u", locale: "en" }]),
    preferenceOverrides: jest.fn().mockResolvedValue(opts.overrides ?? []),
    recordAttempt: jest.fn(),
    finishDelivery: jest.fn().mockResolvedValue(true),
  }
  const adapter = { channel: "telegram", available: jest.fn().mockResolvedValue(opts.available ?? true), send: jest.fn().mockResolvedValue(opts.result ?? { kind: "accepted", providerMessageId: "m1" }) }
  const access = { allowed: jest.fn().mockResolvedValue(opts.allowed ?? true) }
  return { processor: new DeliveryProcessor(repo as any, [adapter] as any, access as any), repo, adapter }
}

const attempt = { made: 1, max: 6 }

describe("DeliveryProcessor.process", () => {
  it("sends and records provider message id", async () => {
    const { processor, repo, adapter } = setup()
    expect(await processor.process("d1", attempt, NOW)).toEqual({ kind: "done" })
    expect(adapter.send).toHaveBeenCalledTimes(1)
    expect(repo.finishDelivery).toHaveBeenCalledWith("d1", { status: "sent", providerMessageId: "m1" })
  })

  it("ignores a delivery that already finished (duplicate job)", async () => {
    const { processor, adapter } = setup({ ctx: ctx({ delivery: { status: "sent" } }) })
    await processor.process("d1", attempt, NOW)
    expect(adapter.send).not.toHaveBeenCalled()
  })

  it.each([
    ["kill_switch", { switches: [{ typeKey: "t", channel: null }] }],
    ["expired", { ctx: ctx({ notification: { expiresAt: new Date("2026-11-12T09:00:00Z") } }) }],
    ["no_access", { users: [] }],
    ["no_access", { allowed: false }], // subject no longer visible to the recipient
    ["preference", { overrides: [{ userId: "u", category: "activity", channel: "telegram", enabled: false }] }],
    ["not_connected", { available: false }],
  ])("skips with reason %s without sending", async (reason, opts) => {
    const { processor, repo, adapter } = setup(opts as any)
    await processor.process("d1", attempt, NOW)
    expect(adapter.send).not.toHaveBeenCalled()
    expect(repo.finishDelivery).toHaveBeenCalledWith("d1", { status: "skipped", skipReason: reason })
  })

  it("marks a permanent error failed and does not retry", async () => {
    const { processor, repo } = setup({ result: { kind: "permanent", code: "blocked" } })
    expect(await processor.process("d1", attempt, NOW)).toEqual({ kind: "done" })
    expect(repo.finishDelivery).toHaveBeenCalledWith("d1", { status: "failed", errorCode: "blocked" })
  })

  it("asks for a retry on a retryable error, carrying retry_after", async () => {
    const { processor, repo } = setup({ result: { kind: "retryable", code: "429", retryAfterMs: 2000 } })
    expect(await processor.process("d1", attempt, NOW)).toEqual({ kind: "retry", code: "429", retryAfterMs: 2000 })
    expect(repo.finishDelivery).not.toHaveBeenCalled()
  })

  it("fails the delivery once retries are exhausted", async () => {
    const { processor, repo } = setup({ result: { kind: "retryable", code: "503" } })
    expect(await processor.process("d1", { made: 6, max: 6 }, NOW)).toEqual({ kind: "exhausted", code: "503" })
    expect(repo.finishDelivery).toHaveBeenCalledWith("d1", { status: "failed", errorCode: "503" })
  })
})
