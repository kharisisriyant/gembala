import { TelegramAdapter } from "./telegram.adapter"

const ctx = (over: object = {}) => ({
  deliveryId: "d", correlationId: "c",
  notification: { id: "n", orgId: "o", userId: "u1", typeKey: "t", category: "activity", title: "Budi <assigned>", body: "A & B", link: "/care", ...over },
}) as any

function setup(opts: { origin?: string; reserve?: jest.Mock; push?: any } = {}) {
  const telegram = { hasActiveLink: jest.fn().mockResolvedValue(true), pushToUser: jest.fn().mockResolvedValue(opts.push ?? { kind: "sent", messageId: "9" }) }
  const redis = { reserve: opts.reserve ?? jest.fn().mockResolvedValue(0) }
  const endpoints = { emailTarget: jest.fn().mockResolvedValue({ locale: "en" }) }
  const config = { getOrThrow: () => opts.origin ?? "https://app.test" }
  return { adapter: new TelegramAdapter(telegram as any, redis as any, endpoints as any, config as any), telegram, redis }
}

describe("TelegramAdapter", () => {
  it("escapes user text, sends HTML with an https app button", async () => {
    const { adapter, telegram } = setup()
    expect(await adapter.send(ctx())).toEqual({ kind: "accepted", providerMessageId: "9" })
    expect(telegram.pushToUser).toHaveBeenCalledWith("u1", {
      text: "<b>Budi &lt;assigned&gt;</b>\nA &amp; B",
      parseMode: "HTML",
      buttonUrl: "https://app.test/care",
      buttonText: "Open",
    })
  })

  it("omits the button when the web origin is not https", async () => {
    const { adapter, telegram } = setup({ origin: "http://localhost:5173" })
    await adapter.send(ctx())
    expect(telegram.pushToUser.mock.calls[0][1].buttonUrl).toBeUndefined()
  })

  it("keeps messages under the 4096 cap", async () => {
    const { adapter, telegram } = setup()
    await adapter.send(ctx({ body: "x".repeat(6000) }))
    expect(telegram.pushToUser.mock.calls[0][1].text.length).toBeLessThanOrEqual(4096)
  })

  it("waits for the per-chat gate, then sends", async () => {
    const reserve = jest.fn().mockResolvedValueOnce(5).mockResolvedValueOnce(0)
    const { adapter, telegram } = setup({ reserve })
    await adapter.send(ctx())
    expect(reserve).toHaveBeenCalledTimes(2)
    expect(reserve).toHaveBeenCalledWith("notif:tg:chat:u1", 1000)
    expect(telegram.pushToUser).toHaveBeenCalled()
  })

  it("asks for a retry when the gate stays shut", async () => {
    const { adapter, telegram } = setup({ reserve: jest.fn().mockResolvedValue(1) })
    expect(await adapter.send(ctx())).toEqual({ kind: "retryable", code: "chat_throttle", retryAfterMs: 1 })
    expect(telegram.pushToUser).not.toHaveBeenCalled()
  })

  it.each([
    [{ kind: "no_link" }, { kind: "permanent", code: "not_connected" }],
    [{ kind: "permanent", code: "blocked" }, { kind: "permanent", code: "blocked" }],
    [{ kind: "retryable", code: "429", retryAfterMs: 2000 }, { kind: "retryable", code: "429", retryAfterMs: 2000 }],
  ])("maps %j", async (push, expected) => {
    expect(await setup({ push }).adapter.send(ctx())).toEqual(expected)
  })

  it("reports availability from the link", async () => {
    const { adapter, telegram } = setup()
    expect(await adapter.available("u1")).toBe(true)
    telegram.hasActiveLink.mockResolvedValue(false)
    expect(await adapter.available("u1")).toBe(false)
  })
})
