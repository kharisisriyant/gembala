import { TelegramService } from "./telegram.service"
import type { TelegramRepository } from "./telegram.repository"
import type { ConfigService } from "@nestjs/config"
import type { AuthContextService } from "../authz/auth-context.service"
import type { TelegramAgentService } from "./telegram-agent.service"

function makeRepo(): jest.Mocked<TelegramRepository> {
  return {
    findActiveLinkForUser: jest.fn(),
    findActiveCodeForUser: jest.fn(),
    insertCode: jest.fn(),
    revokeActiveLinkForUser: jest.fn(),
    revokeActiveLinkByChatId: jest.fn().mockResolvedValue([]),
    bindChat: jest.fn(),
    hasBlockedLink: jest.fn().mockResolvedValue(false),
    recordTelegramStop: jest.fn(),
    findActiveLinkByChatId: jest.fn(),
    findActiveLinkRowByChatId: jest.fn(),
    findActiveCodeByCode: jest.fn(),
    insertLink: jest.fn(),
    deleteCode: jest.fn(),
  } as unknown as jest.Mocked<TelegramRepository>
}

const auth = { userId: "user-1" } as any

describe("TelegramService", () => {
  let links: jest.Mocked<TelegramRepository>
  let config: jest.Mocked<ConfigService>
  let authContext: jest.Mocked<AuthContextService>
  let agent: jest.Mocked<TelegramAgentService>
  let service: TelegramService

  beforeEach(() => {
    links = makeRepo()
    config = { get: jest.fn() } as any
    authContext = { load: jest.fn() } as any
    agent = { isConfigured: false, processMessage: jest.fn() } as any
    service = new TelegramService(links, config, authContext, agent)
  })

  describe("getStatus", () => {
    it("reports linked when an active link exists", async () => {
      links.findActiveLinkForUser.mockResolvedValue({ telegramUsername: "kharis" } as any)

      const result = await service.getStatus(auth)

      expect(result).toEqual({ linked: true, telegramUsername: "kharis" })
      expect(links.findActiveCodeForUser).not.toHaveBeenCalled()
    })

    it("reuses an existing unexpired code instead of minting a new one", async () => {
      links.findActiveLinkForUser.mockResolvedValue(undefined as any)
      links.findActiveCodeForUser.mockResolvedValue({
        code: "ABCD1234",
        expiresAt: new Date("2026-01-01T00:00:00Z"),
      } as any)

      const result = await service.getStatus(auth)

      expect(result).toMatchObject({ linked: false, code: "ABCD1234" })
      expect(links.insertCode).not.toHaveBeenCalled()
    })

    it("mints a new code when none exists", async () => {
      links.findActiveLinkForUser.mockResolvedValue(undefined as any)
      links.findActiveCodeForUser.mockResolvedValue(undefined as any)
      links.insertCode.mockResolvedValue({
        code: "NEWCODE1",
        expiresAt: new Date("2026-01-01T00:00:00Z"),
      } as any)

      const result = await service.getStatus(auth)

      expect(result).toMatchObject({ linked: false, code: "NEWCODE1" })
      expect(links.insertCode).toHaveBeenCalledWith(auth.userId, expect.any(String), expect.any(Date))
    })
  })

  describe("revoke", () => {
    it("delegates to the repository", async () => {
      await service.revoke(auth)
      expect(links.revokeActiveLinkForUser).toHaveBeenCalledWith(auth.userId)
    })
  })

  describe("handleUpdate", () => {
    it("ignores updates without message text", async () => {
      await service.handleUpdate({})
      expect(links.findActiveLinkByChatId).not.toHaveBeenCalled()
    })

    it("routes /link <code> to code consumption", async () => {
      links.findActiveLinkRowByChatId.mockResolvedValue(undefined as any)
      links.findActiveCodeByCode.mockResolvedValue(undefined as any)

      await service.handleUpdate({
        message: { text: "/link ABCD1234", chat: { id: 42 }, from: { username: "kharis" } },
      })

      expect(links.findActiveCodeByCode).toHaveBeenCalledWith("ABCD1234")
    })

    it("routes free text through the link check", async () => {
      links.findActiveLinkByChatId.mockResolvedValue(undefined as any)

      await service.handleUpdate({ message: { text: "hello", chat: { id: 42 } } })

      expect(links.findActiveLinkByChatId).toHaveBeenCalledWith("42")
    })
  })

  describe("telegram hardening", () => {
    const sent: any[] = []
    beforeEach(() => {
      sent.length = 0
      config.get.mockImplementation(((k: string) => (k === "TELEGRAM_BOT_TOKEN" ? "tok" : undefined)) as any)
      service = new TelegramService(links, config, authContext, agent)
      global.fetch = jest.fn(async (_url: string, init: any) => {
        sent.push(JSON.parse(init.body))
        return { ok: true, status: 200, statusText: "ok", json: async () => ({ ok: true, result: { message_id: 1 } }) }
      }) as any
    })

    it("ignores group chats (TG-11)", async () => {
      await service.handleUpdate({ message: { text: "/link ABCD1234", chat: { id: -5, type: "group" } } })
      expect(links.findActiveCodeByCode).not.toHaveBeenCalled()
      expect(sent).toHaveLength(0)
    })

    it("links from the /start <code> deep link and replaces older links (TG-1, TG-3)", async () => {
      links.findActiveCodeByCode.mockResolvedValue({ id: "code1", userId: "u9" } as any)
      await service.handleUpdate({ message: { text: "/start abcd1234", chat: { id: 42, type: "private" }, from: { username: "k" } } })
      expect(links.findActiveCodeByCode).toHaveBeenCalledWith("ABCD1234")
      expect(links.bindChat).toHaveBeenCalledWith({ userId: "u9", telegramChatId: "42", telegramUsername: "k", codeId: "code1" })
    })

    it("rejects an invalid or expired code without binding", async () => {
      links.findActiveCodeByCode.mockResolvedValue(undefined as any)
      await service.handleUpdate({ message: { text: "/start NOPE", chat: { id: 42, type: "private" } } })
      expect(links.bindChat).not.toHaveBeenCalled()
    })

    it("/stop unlinks the chat and records the opt-out (TG-4)", async () => {
      links.revokeActiveLinkByChatId.mockResolvedValue(["u1"])
      await service.handleUpdate({ message: { text: "/stop", chat: { id: 42, type: "private" } } })
      expect(links.revokeActiveLinkByChatId).toHaveBeenCalledWith("42", "stop")
      expect(links.recordTelegramStop).toHaveBeenCalledWith("u1")
    })

    it("pushToUser retires the link and reports blocked on HTTP 403 (TG-5)", async () => {
      links.findActiveLinkForUser.mockResolvedValue({ telegramChatId: "42" } as any)
      global.fetch = jest.fn(async () => ({ ok: false, status: 403, statusText: "Forbidden", json: async () => ({ ok: false }) })) as any
      expect(await service.pushToUser("u1", { text: "x" })).toEqual({ kind: "permanent", code: "blocked" })
      expect(links.revokeActiveLinkByChatId).toHaveBeenCalledWith("42", "blocked")
    })

    it("pushToUser retries 429/5xx and gives up on other 4xx", async () => {
      links.findActiveLinkForUser.mockResolvedValue({ telegramChatId: "42" } as any)
      const respond = (status: number, body: object) => (global.fetch = jest.fn(async () => ({ ok: false, status, statusText: "x", json: async () => body })) as any)
      respond(429, { parameters: { retry_after: 2 } })
      expect(await service.pushToUser("u1", { text: "x" })).toEqual({ kind: "retryable", code: "429", retryAfterMs: 2000 })
      respond(502, {})
      expect(await service.pushToUser("u1", { text: "x" })).toMatchObject({ kind: "retryable", code: "502" })
      respond(400, { description: "chat not found" })
      expect(await service.pushToUser("u1", { text: "x" })).toEqual({ kind: "permanent", code: "400" })
      expect(links.revokeActiveLinkByChatId).not.toHaveBeenCalled()
    })

    it("pushToUser reports no_link without calling Telegram", async () => {
      links.findActiveLinkForUser.mockResolvedValue(undefined as any)
      expect(await service.pushToUser("u1", { text: "x" })).toEqual({ kind: "no_link" })
      expect(global.fetch).not.toHaveBeenCalledWith(expect.stringContaining("sendMessage"), expect.anything())
    })

    it("status flags a disconnected (blocked) link", async () => {
      links.findActiveLinkForUser.mockResolvedValue(undefined as any)
      links.findActiveCodeForUser.mockResolvedValue({ code: "C", expiresAt: new Date() } as any)
      links.hasBlockedLink.mockResolvedValue(true)
      expect(await service.getStatus(auth)).toMatchObject({ linked: false, disconnected: true })
    })
  })
})
