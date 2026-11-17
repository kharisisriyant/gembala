import { BadRequestException } from "@nestjs/common"
import { PreferencesService } from "./preferences.service"

const reminderType = { key: "r", category: "reminder" } as any
const productType = { key: "p", category: "product_updates" } as any

function setup(opts: { overrides?: any[]; types?: any[]; bounced?: boolean; tg?: string } = {}) {
  const repo = {
    overrides: jest.fn().mockResolvedValue(opts.overrides ?? []),
    upsertPreference: jest.fn(),
    insertConsent: jest.fn(),
  }
  const endpoints = { emailTarget: jest.fn().mockResolvedValue({ address: "a@x.test", locale: "en", bounced: opts.bounced ?? false }) }
  const telegram = { channelState: jest.fn().mockResolvedValue(opts.tg ?? "not_connected") }
  const tx = {}
  const db: any = { transaction: async (fn: any) => fn(tx) }
  const service = new PreferencesService(repo as any, endpoints as any, telegram as any, db, opts.types ?? [reminderType])
  return { service, repo, tx }
}

describe("PreferencesService.get", () => {
  it("returns defaults, locked cells and channel states", async () => {
    const res = await setup({ tg: "disconnected" }).service.get("u1")
    const activity = res.categories.find((c) => c.category === "activity")!
    expect(activity.cells).toEqual({
      inapp: { enabled: true, locked: true },
      email: { enabled: false, locked: false },
      telegram: { enabled: true, locked: false },
    })
    expect(res.categories.find((c) => c.category === "security")!.cells.email).toEqual({ enabled: true, locked: true })
    expect(res.channels).toEqual({ email: { state: "connected", address: "a@x.test" }, telegram: { state: "disconnected" } })
  })

  it("applies the user's overrides", async () => {
    const { service } = setup({ overrides: [{ category: "activity", channel: "email", enabled: true }] })
    const activity = (await service.get("u1")).categories.find((c) => c.category === "activity")!
    expect(activity.cells.email.enabled).toBe(true)
  })

  it("hides product updates until a type exists", async () => {
    expect((await setup().service.get("u1")).categories.map((c) => c.category)).not.toContain("product_updates")
    expect((await setup({ types: [productType] }).service.get("u1")).categories.map((c) => c.category)).toContain("product_updates")
  })

  it("flags a bounced email", async () => {
    expect((await setup({ bounced: true }).service.get("u1")).channels.email.state).toBe("bounced")
  })
})

describe("PreferencesService.update", () => {
  it.each([
    ["activity", "inapp"],
    ["security", "email"],
  ])("rejects locked %s/%s", async (category, channel) => {
    const { service, repo } = setup()
    await expect(service.update("u1", { category, channel, enabled: false } as any)).rejects.toBeInstanceOf(BadRequestException)
    expect(repo.upsertPreference).not.toHaveBeenCalled()
  })

  it("saves the change and logs consent from settings in one transaction", async () => {
    const { service, repo, tx } = setup()
    await service.update("u1", { category: "activity", channel: "email", enabled: true })
    expect(repo.upsertPreference).toHaveBeenCalledWith("u1", "activity", "email", true, tx)
    expect(repo.insertConsent).toHaveBeenCalledWith(
      { userId: "u1", category: "activity", channel: "email", enabled: true, source: "settings", actorUserId: "u1" },
      tx,
    )
  })

  it("does not log a no-op change", async () => {
    const { service, repo } = setup()
    await service.update("u1", { category: "activity", channel: "telegram", enabled: true }) // already on
    expect(repo.upsertPreference).not.toHaveBeenCalled()
    expect(repo.insertConsent).not.toHaveBeenCalled()
  })
})
