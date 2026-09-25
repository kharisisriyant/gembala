import { ForbiddenException } from "@nestjs/common"
import { ScopeService, type TagRow } from "./scope.service"
import type { ScopeRepository } from "./scope.repository"

const youth: TagRow = { id: "t1", name: "youth", parentId: null, description: null }
const youthLeaders: TagRow = { id: "t2", name: "youth-leaders", parentId: "t1", description: null }

describe("ScopeService", () => {
  let repo: jest.Mocked<ScopeRepository>
  let service: ScopeService

  beforeEach(() => {
    repo = { orgTags: jest.fn() } as any
    service = new ScopeService(repo)
  })

  describe("expandedScope", () => {
    it("returns null (full access) for a system admin", async () => {
      const result = await service.expandedScope({ scopeTagNames: null } as any)

      expect(result).toBeNull()
      expect(repo.orgTags).not.toHaveBeenCalled()
    })

    it("expands a scoped caller's tags to include descendants", async () => {
      repo.orgTags.mockResolvedValue([youth, youthLeaders])

      const result = await service.expandedScope({ orgId: "org-1", scopeTagNames: ["youth"] } as any)

      expect(result?.has("youth")).toBe(true)
      expect(result?.has("youth-leaders")).toBe(true)
    })

    it("reuses tagRows when passed in, skipping the query", async () => {
      await service.expandedScope({ orgId: "org-1", scopeTagNames: ["youth"] } as any, [youth])

      expect(repo.orgTags).not.toHaveBeenCalled()
    })
  })

  describe("memberVisible / groupVisible", () => {
    it("null scope (admin) sees everything", () => {
      expect(service.memberVisible(null, [])).toBe(true)
      expect(service.groupVisible(null, "anything")).toBe(true)
    })

    it("scoped caller only sees tags inside their scope", () => {
      const scope = new Set(["youth"])
      expect(service.memberVisible(scope, ["youth"])).toBe(true)
      expect(service.memberVisible(scope, ["elders"])).toBe(false)
      expect(service.groupVisible(scope, "elders")).toBe(false)
    })
  })

  describe("assertGroupVisible / assertCanWriteMemberTags", () => {
    it("throws ForbiddenException when out of scope", () => {
      const scope = new Set(["youth"])
      expect(() => service.assertGroupVisible(scope, "elders")).toThrow(ForbiddenException)
      expect(() => service.assertCanWriteMemberTags(scope, ["elders"])).toThrow(ForbiddenException)
    })

    it("does not throw when in scope", () => {
      const scope = new Set(["youth"])
      expect(() => service.assertGroupVisible(scope, "youth")).not.toThrow()
      expect(() => service.assertCanWriteMemberTags(scope, ["youth"])).not.toThrow()
    })
  })
})
