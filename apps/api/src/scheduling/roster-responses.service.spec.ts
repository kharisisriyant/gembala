import { ConflictException, HttpException, NotFoundException, ServiceUnavailableException } from "@nestjs/common"
import { RosterResponsesService, responsesOpen } from "./roster-responses.service"
import type { RosterResponsesRepository } from "./roster-responses.repository"
import { signRosterToken } from "./roster-token"

const SECRET = "test-secret-test-secret-test-secret-123"
const ID = "11111111-1111-4111-8111-111111111111"
const NONCE = "22222222-2222-4222-8222-222222222222"
// 2026-11-20 10:00 in Jakarta; the service below is on Sunday 2026-11-22.
const NOW = new Date("2026-11-20T03:00:00Z")
const auth = { userId: "leader-1", orgId: "org-1" } as any

function context(overrides: Record<string, unknown> = {}) {
  return {
    assignment: {
      id: ID,
      linkNonce: NONCE,
      memberId: "m1",
      responseStatus: "pending",
      respondedAt: null,
      declineReason: "",
      notifiedAt: null,
      requestedByUserId: "leader-1",
    },
    member: { id: "m1", name: "Budi", email: "budi@example.com" },
    roleName: "Usher",
    serviceName: "KU1",
    event: { id: "e1", orgId: "org-1", date: "2026-11-22", theme: "Grace" },
    churchName: "GKI Test",
    ...overrides,
  } as any
}

describe("RosterResponsesService", () => {
  let repo: jest.Mocked<RosterResponsesRepository>
  let mail: { sendNotification: jest.Mock }
  let notifications: { notify: jest.Mock }
  let service: RosterResponsesService
  const token = signRosterToken(SECRET, ID, NONCE)

  beforeEach(() => {
    repo = {
      findContext: jest.fn(),
      update: jest.fn(async (_id: string, patch: object) => ({ ...context().assignment, ...patch })),
      consumeRateLimit: jest.fn().mockResolvedValue(true),
    } as any
    mail = { sendNotification: jest.fn().mockResolvedValue({}) }
    notifications = { notify: jest.fn().mockResolvedValue(true) }
    const config = { getOrThrow: (key: string) => (key === "WEB_ORIGIN" ? "https://app.example" : SECRET) }
    const db = { transaction: (fn: (tx: unknown) => unknown) => fn("tx") }
    service = new RosterResponsesService(repo, config as any, mail as any, notifications as any, db as any)
  })

  describe("responsesOpen", () => {
    it("closes when the service day begins in Asia/Jakarta", () => {
      expect(responsesOpen("2026-11-22", new Date("2026-11-21T16:59:00Z"))).toBe(true)
      expect(responsesOpen("2026-11-22", new Date("2026-11-21T17:00:00Z"))).toBe(false)
    })
  })

  describe("link", () => {
    it("returns a signed link and records the requesting leader", async () => {
      repo.findContext.mockResolvedValue(context())
      const { url } = await service.link(auth, ID)
      expect(url).toBe(`https://app.example/roster/respond?token=${encodeURIComponent(token)}`)
      expect(repo.update).toHaveBeenCalledWith(ID, { requestedByUserId: "leader-1" })
    })

    it("404s for an assignment in another org", async () => {
      repo.findContext.mockResolvedValue(context({ event: { id: "e1", orgId: "other", date: "2026-11-22", theme: "" } }))
      await expect(service.link(auth, ID)).rejects.toThrow(NotFoundException)
    })

    it("rejects a free-text assignment", async () => {
      repo.findContext.mockResolvedValue(context({ member: null }))
      await expect(service.link(auth, ID)).rejects.toThrow(ConflictException)
    })
  })

  describe("notify", () => {
    it("emails the member and stamps notifiedAt", async () => {
      repo.findContext.mockResolvedValue(context())
      const result = await service.notify(auth, ID, { locale: "id" }, NOW)
      expect(mail.sendNotification).toHaveBeenCalledWith("budi@example.com", expect.objectContaining({ subject: expect.stringContaining("GKI Test") }))
      expect(mail.sendNotification.mock.calls[0][1].text).toContain(token)
      expect(repo.update).toHaveBeenCalledWith(ID, { requestedByUserId: "leader-1", notifiedAt: NOW })
      expect(result).toEqual({ sentTo: "email", url: expect.any(String), notifiedAt: NOW.toISOString() })
    })

    it("returns the link without sending when the member has no email", async () => {
      repo.findContext.mockResolvedValue(context({ member: { id: "m1", name: "Budi", email: "" } }))
      const result = await service.notify(auth, ID, { locale: "en" }, NOW)
      expect(mail.sendNotification).not.toHaveBeenCalled()
      expect(result.sentTo).toBeNull()
      expect(result.url).toContain("/roster/respond?token=")
    })

    it("refuses once the service has started", async () => {
      repo.findContext.mockResolvedValue(context())
      await expect(service.notify(auth, ID, { locale: "en" }, new Date("2026-11-22T01:00:00Z"))).rejects.toThrow(ConflictException)
      expect(mail.sendNotification).not.toHaveBeenCalled()
    })

    it("reports a mail failure without stamping notifiedAt", async () => {
      repo.findContext.mockResolvedValue(context())
      mail.sendNotification.mockRejectedValue(new Error("down"))
      await expect(service.notify(auth, ID, { locale: "en" }, NOW)).rejects.toThrow(ServiceUnavailableException)
      expect(repo.update).not.toHaveBeenCalled()
    })
  })

  describe("view", () => {
    it("shows only this assignment, without contact details", async () => {
      repo.findContext.mockResolvedValue(context())
      const view = await service.view(token, "1.2.3.4", NOW)
      expect(view).toEqual({
        churchName: "GKI Test",
        date: "2026-11-22",
        theme: "Grace",
        serviceName: "KU1",
        roleName: "Usher",
        memberName: "Budi",
        status: "pending",
        respondedAt: null,
        declineReason: "",
        open: true,
      })
      expect(JSON.stringify(view)).not.toContain("budi@example.com")
    })

    it("404s on a tampered token", async () => {
      repo.findContext.mockResolvedValue(context())
      await expect(service.view(`${token.slice(0, -2)}xx`, "ip", NOW)).rejects.toThrow(NotFoundException)
    })

    it("404s once the nonce was rotated (member or role changed)", async () => {
      repo.findContext.mockResolvedValue(context({ assignment: { ...context().assignment, linkNonce: "33333333-3333-4333-8333-333333333333" } }))
      await expect(service.view(token, "ip", NOW)).rejects.toThrow(NotFoundException)
    })

    it("404s when the assignment was deleted or the token is malformed", async () => {
      repo.findContext.mockResolvedValue(undefined as any)
      await expect(service.view(token, "ip", NOW)).rejects.toThrow(NotFoundException)
      await expect(service.view("not-a-token", "ip", NOW)).rejects.toThrow(NotFoundException)
    })

    it("429s when the address is over its limit", async () => {
      repo.consumeRateLimit.mockResolvedValue(false)
      await expect(service.view(token, "ip", NOW)).rejects.toThrow(HttpException)
      expect(repo.findContext).not.toHaveBeenCalled()
    })
  })

  describe("respond", () => {
    it("records a confirmation and does not notify", async () => {
      repo.findContext.mockResolvedValue(context())
      const view = await service.respond(token, { status: "confirmed", reason: "ignored" }, "ip", NOW)
      expect(repo.update).toHaveBeenCalledWith(ID, { responseStatus: "confirmed", respondedAt: NOW, declineReason: "" }, "tx")
      expect(view.status).toBe("confirmed")
      expect(notifications.notify).not.toHaveBeenCalled()
    })

    it("records a decline and tells the leader who shared the link", async () => {
      repo.findContext.mockResolvedValue(context())
      const view = await service.respond(token, { status: "declined", reason: "Out of town" }, "ip", NOW)
      expect(view).toMatchObject({ status: "declined", declineReason: "Out of town" })
      expect(notifications.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "roster.declined",
          orgId: "org-1",
          recipients: ["leader-1"],
          payload: { memberName: "Budi", roleName: "Usher", serviceName: "KU1", date: "2026-11-22", reason: "Out of town" },
        }),
        "tx",
      )
    })

    it("does not notify again when an existing decline is edited", async () => {
      repo.findContext.mockResolvedValue(context({ assignment: { ...context().assignment, responseStatus: "declined" } }))
      await service.respond(token, { status: "declined", reason: "Sick" }, "ip", NOW)
      expect(notifications.notify).not.toHaveBeenCalled()
    })

    it("rejects answers once the service day has begun", async () => {
      repo.findContext.mockResolvedValue(context())
      await expect(service.respond(token, { status: "confirmed" }, "ip", new Date("2026-11-21T17:00:00Z"))).rejects.toThrow(ConflictException)
      expect(repo.update).not.toHaveBeenCalled()
    })
  })
})
