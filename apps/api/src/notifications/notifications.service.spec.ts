import { z } from "zod"
import { NotificationsService } from "./notifications.service"
import type { NotificationType } from "./notifications.catalog"

const type: NotificationType<{ name: string }> = {
  key: "test.assigned",
  category: "activity",
  priority: "normal",
  defaultChannels: ["telegram", "email"],
  ttlMs: 60_000,
  payload: z.object({ name: z.string() }),
  render: (locale, p) => ({ title: `${locale}:${p.name}`, body: "b", link: "/x" }),
}

const event = (over = {}) => ({
  id: "e1", orgId: "o1", typeKey: "test.assigned", idempotencyKey: "k", recipientUserIds: ["u1", "u2"],
  payload: { name: "Budi" }, actorUserId: "u2", sendAt: null, correlationId: "c1", processedAt: null,
  createdAt: new Date("2026-11-12T00:00:00Z"), ...over,
})

function setup(opts: { users?: any[]; overrides?: any[]; switches?: any[]; telegramAvailable?: boolean } = {}) {
  const repo = {
    insertEvent: jest.fn().mockResolvedValue({ id: "e1" }),
    claimUnprocessedEvents: jest.fn().mockResolvedValue([event()]),
    markEventProcessed: jest.fn(),
    routingUsers: jest.fn().mockResolvedValue(opts.users ?? [{ userId: "u1", locale: "en" }]),
    preferenceOverrides: jest.fn().mockResolvedValue(opts.overrides ?? []),
    killSwitches: jest.fn().mockResolvedValue(opts.switches ?? []),
    insertNotification: jest.fn().mockResolvedValue({ id: "n1" }),
    insertDeliveries: jest.fn(),
  }
  // db.transaction runs the callback with a tx that supports savepoints.
  const tx: any = { transaction: async (fn: any) => fn(tx) }
  const db: any = { transaction: async (fn: any) => fn(tx) }
  const adapters = [
    { channel: "inapp", available: async () => true, send: jest.fn() },
    { channel: "telegram", available: async () => opts.telegramAvailable ?? true, send: jest.fn() },
  ]
  const service = new NotificationsService(repo as any, db, [type], adapters as any)
  return { service, repo }
}

describe("NotificationsService.notify", () => {
  it("stores one event with a correlation id", async () => {
    const { service, repo } = setup()
    expect(await service.notify({ type: "test.assigned", orgId: "o1", recipients: ["u1", "u1"], payload: { name: "Budi" }, idempotencyKey: "k" })).toBe(true)
    const values = repo.insertEvent.mock.calls[0][0]
    expect(values.recipientUserIds).toEqual(["u1"])
    expect(values.correlationId).toMatch(/[0-9a-f-]{36}/)
  })

  it("returns false for a duplicate idempotency key", async () => {
    const { service, repo } = setup()
    repo.insertEvent.mockResolvedValue(null)
    expect(await service.notify({ type: "test.assigned", orgId: "o1", recipients: ["u1"], payload: { name: "x" }, idempotencyKey: "k" })).toBe(false)
  })

  it("rejects a payload that fails the type schema before storing", async () => {
    const { service, repo } = setup()
    await expect(service.notify({ type: "test.assigned", orgId: "o1", recipients: ["u1"], payload: { name: 1 }, idempotencyKey: "k" })).rejects.toThrow()
    expect(repo.insertEvent).not.toHaveBeenCalled()
  })

  it("rejects an unknown type", async () => {
    const { service } = setup()
    await expect(service.notify({ type: "nope", orgId: "o1", recipients: ["u1"], payload: {}, idempotencyKey: "k" })).rejects.toThrow("Unknown notification type")
  })
})

describe("NotificationsService.routePending", () => {
  const rows = (repo: any) => repo.insertDeliveries.mock.calls[0][0] as any[]

  it("excludes the actor and renders in the recipient locale", async () => {
    const { service, repo } = setup()
    await service.routePending()
    expect(repo.routingUsers.mock.calls[0][0]).toEqual(["u1"])
    expect(repo.insertNotification.mock.calls[0][0]).toMatchObject({ userId: "u1", title: "en:Budi", category: "activity" })
    expect(repo.markEventProcessed).toHaveBeenCalledWith("e1", expect.anything())
  })

  it("always creates the in-app delivery and queues connected, enabled channels", async () => {
    const { service, repo } = setup()
    await service.routePending()
    const byChannel = Object.fromEntries(rows(repo).map((r) => [r.channel, r]))
    expect(byChannel.inapp.status).toBe("pending")
    expect(byChannel.telegram.status).toBe("pending")
    expect(byChannel.email).toMatchObject({ status: "skipped", skipReason: "preference" }) // activity email is off by default
  })

  it("records preference-off channels as skipped", async () => {
    const { service, repo } = setup({ overrides: [{ userId: "u1", category: "activity", channel: "telegram", enabled: false }] })
    await service.routePending()
    expect(rows(repo).find((r) => r.channel === "telegram")).toMatchObject({ status: "skipped", skipReason: "preference" })
  })

  it("records unconnected channels as skipped", async () => {
    const { service, repo } = setup({ telegramAvailable: false })
    await service.routePending()
    expect(rows(repo).find((r) => r.channel === "telegram")).toMatchObject({ status: "skipped", skipReason: "not_connected" })
  })

  it("applies kill switches per type and per channel", async () => {
    const { service, repo } = setup({ switches: [{ typeKey: null, channel: "telegram" }] })
    await service.routePending()
    expect(rows(repo).find((r) => r.channel === "telegram")).toMatchObject({ status: "skipped", skipReason: "kill_switch" })
    expect(rows(repo).find((r) => r.channel === "inapp").status).toBe("pending")
  })

  it("creates nothing for recipients without an active membership", async () => {
    const { service, repo } = setup({ users: [] })
    await service.routePending()
    expect(repo.insertNotification).not.toHaveBeenCalled()
    expect(repo.markEventProcessed).toHaveBeenCalled()
  })

  it("marks a poison event processed instead of retrying forever", async () => {
    const { service, repo } = setup()
    repo.insertNotification.mockRejectedValue(new Error("boom"))
    await service.routePending()
    expect(repo.markEventProcessed).toHaveBeenCalledWith("e1", expect.anything())
  })

  it("does not duplicate deliveries when the notification already exists", async () => {
    const { service, repo } = setup()
    repo.insertNotification.mockResolvedValue(null)
    await service.routePending()
    expect(repo.insertDeliveries).not.toHaveBeenCalled()
  })
})
