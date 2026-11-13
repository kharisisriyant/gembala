import { MailSendError } from "../mail/mail.service"
import { EmailAdapter } from "./email.adapter"

const config = { getOrThrow: (k: string) => ({ WEB_ORIGIN: "https://app.test", NOTIFICATION_LINK_SECRET: "s".repeat(40), API_PUBLIC_URL: "https://api.test/api" } as any)[k] }
const ctx = (category: string) => ({
  deliveryId: "d1", correlationId: "c1",
  notification: { id: "n", orgId: "o", userId: "u1", typeKey: "t", category, title: "Hi", body: "Body", link: "/care" },
}) as any

function setup(opts: { target?: any; send?: jest.Mock } = {}) {
  const mail = { sendNotification: opts.send ?? jest.fn().mockResolvedValue({ id: "msg1" }) }
  const endpoints = { emailTarget: jest.fn().mockResolvedValue("target" in opts ? opts.target : { address: "a@x.test", locale: "en", bounced: false }) }
  return { adapter: new EmailAdapter(mail as any, endpoints as any, config as any), mail }
}

describe("EmailAdapter", () => {
  it("is unavailable for bounced or unknown users", async () => {
    expect(await setup({ target: { address: "a", locale: "en", bounced: true } }).adapter.available("u1")).toBe(false)
    expect(await setup({ target: null }).adapter.available("u1")).toBe(false)
    expect(await setup().adapter.available("u1")).toBe(true)
  })

  it.each(["activity", "reminder", "product_updates"])("adds one-click unsubscribe headers for %s", async (category) => {
    const { adapter, mail } = setup()
    expect(await adapter.send(ctx(category))).toEqual({ kind: "accepted", providerMessageId: "msg1" })
    const [to, message] = mail.sendNotification.mock.calls[0]
    expect(to).toBe("a@x.test")
    expect(message.headers["List-Unsubscribe"]).toMatch(/^<https:\/\/api\.test\/api\/notifications\/unsubscribe\?token=.+>$/)
    expect(message.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click")
    expect(message.html).toContain("/unsubscribe?token=")
    expect(message.text.length).toBeGreaterThan(0)
  })

  it.each(["security", "transactional"])("sends %s mail without unsubscribe", async (category) => {
    const { adapter, mail } = setup()
    await adapter.send(ctx(category))
    const [, message] = mail.sendNotification.mock.calls[0]
    expect(message.headers).toEqual({})
    expect(message.html).not.toContain("unsubscribe")
  })

  it("classifies provider errors", async () => {
    const retry = setup({ send: jest.fn().mockRejectedValue(new MailSendError("x", true, "503", 1000)) })
    expect(await retry.adapter.send(ctx("activity"))).toEqual({ kind: "retryable", code: "503", retryAfterMs: 1000 })
    const perm = setup({ send: jest.fn().mockRejectedValue(new MailSendError("x", false, "422")) })
    expect(await perm.adapter.send(ctx("activity"))).toEqual({ kind: "permanent", code: "422" })
  })

  it("never sends to a suppressed address", async () => {
    const { adapter, mail } = setup({ target: { address: "a", locale: "en", bounced: true } })
    expect(await adapter.send(ctx("activity"))).toEqual({ kind: "permanent", code: "suppressed" })
    expect(mail.sendNotification).not.toHaveBeenCalled()
  })
})
