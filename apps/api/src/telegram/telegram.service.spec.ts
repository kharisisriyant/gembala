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
})
