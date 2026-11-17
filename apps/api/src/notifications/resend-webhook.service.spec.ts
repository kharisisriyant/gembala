import { UnauthorizedException } from "@nestjs/common"
import { createHmac } from "node:crypto"
import { ResendWebhookService } from "./resend-webhook.service"

const key = Buffer.from("k".repeat(24))
const secret = `whsec_${key.toString("base64")}`

function signed(event: object) {
  const body = JSON.stringify(event)
  const id = "msg_1"
  const timestamp = String(Math.floor(Date.now() / 1000))
  const sig = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64")
  return { body, headers: { "svix-id": id, "svix-timestamp": timestamp, "svix-signature": `v1,${sig}` } }
}
const email = (type: string, data: object = {}) => ({ type, created_at: "2026-11-12T00:00:00Z", data: { email_id: "prov1", to: ["a@x.test"], ...data } })

function setup(secretValue: string | null = secret, delivery: any = { id: "d1", userId: "u1", status: "sent", correlationId: "c1" }) {
  const endpoints = {
    deliveryByProviderId: jest.fn().mockResolvedValue(delivery),
    setProviderStatus: jest.fn(),
    markEmailBounced: jest.fn(),
  }
  const service = new ResendWebhookService({ get: () => secretValue ?? undefined } as any, endpoints as any)
  return { service, endpoints }
}

describe("ResendWebhookService", () => {
  it("rejects a bad signature and a missing secret", async () => {
    const { body, headers } = signed(email("email.delivered"))
    await expect(setup().service.handle(body, { ...headers, "svix-signature": "v1,AAAA" })).rejects.toBeInstanceOf(UnauthorizedException)
    await expect(setup(null).service.handle(body, headers)).rejects.toBeInstanceOf(UnauthorizedException)
    await expect(setup().service.handle(body + " ", headers)).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it("marks delivered", async () => {
    const { service, endpoints } = setup()
    const { body, headers } = signed(email("email.delivered"))
    await service.handle(body, headers)
    expect(endpoints.setProviderStatus).toHaveBeenCalledWith("d1", "delivered")
    expect(endpoints.markEmailBounced).not.toHaveBeenCalled()
  })

  it("suppresses the address on a permanent bounce, using the delivery's user", async () => {
    const { service, endpoints } = setup()
    const { body, headers } = signed(email("email.bounced", { bounce: { type: "Permanent", subType: "General", message: "x" }, to: ["forged@x.test"] }))
    await service.handle(body, headers)
    expect(endpoints.setProviderStatus).toHaveBeenCalledWith("d1", "failed", "bounced")
    expect(endpoints.markEmailBounced).toHaveBeenCalledWith("u1", "forged@x.test")
  })

  it("does not suppress on a transient bounce", async () => {
    const { service, endpoints } = setup()
    const { body, headers } = signed(email("email.bounced", { bounce: { type: "Transient", subType: "MailboxFull", message: "x" } }))
    await service.handle(body, headers)
    expect(endpoints.setProviderStatus).toHaveBeenCalledWith("d1", "failed", "soft_bounce")
    expect(endpoints.markEmailBounced).not.toHaveBeenCalled()
  })

  it("suppresses on a complaint", async () => {
    const { service, endpoints } = setup()
    const { body, headers } = signed(email("email.complained"))
    await service.handle(body, headers)
    expect(endpoints.setProviderStatus).toHaveBeenCalledWith("d1", "failed", "complained")
    expect(endpoints.markEmailBounced).toHaveBeenCalled()
  })

  it("ignores unknown deliveries and unrelated event types", async () => {
    const { service, endpoints } = setup(secret, null)
    const a = signed(email("email.delivered"))
    await service.handle(a.body, a.headers)
    const b = signed(email("email.opened"))
    await setup().service.handle(b.body, b.headers)
    expect(endpoints.setProviderStatus).not.toHaveBeenCalled()
  })
})
