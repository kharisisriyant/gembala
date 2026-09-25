import { ForbiddenException, NotFoundException } from "@nestjs/common"
import { InvitesService } from "./invites.service"
import type { InvitesRepository } from "./invites.repository"
import type { TagsService } from "../tags/tags.service"
import type { RolesService } from "../roles/roles.service"
import type { MailService } from "../mail/mail.service"
import type { ConfigService } from "@nestjs/config"
import type { Db } from "../db/drizzle.module"

function makeRepo(): jest.Mocked<InvitesRepository> {
  return {
    listByOrg: jest.fn(),
    scopeTagNamesByInviteIds: jest.fn(),
    rolesByInviteIds: jest.fn(),
    insert: jest.fn(),
    insertScopeTags: jest.fn(),
    insertRoles: jest.fn(),
    revoke: jest.fn(),
    findByTokenHashWithOrg: jest.fn(),
    scopeTagNamesByInviteId: jest.fn(),
    rolesByInviteId: jest.fn(),
  } as unknown as jest.Mocked<InvitesRepository>
}

const auth = { orgId: "org-1", userId: "user-1", orgName: "Grace Church" } as any

describe("InvitesService", () => {
  let invites: jest.Mocked<InvitesRepository>
  let tags: jest.Mocked<TagsService>
  let roles: jest.Mocked<RolesService>
  let mail: jest.Mocked<MailService>
  let config: jest.Mocked<ConfigService>
  let db: jest.Mocked<Db>
  let service: InvitesService

  beforeEach(() => {
    invites = makeRepo()
    tags = { resolveTagIds: jest.fn() } as any
    roles = { assignableRoles: jest.fn() } as any
    mail = { sendInvite: jest.fn() } as any
    config = { getOrThrow: jest.fn().mockReturnValue("https://app.example.com") } as any
    db = { transaction: jest.fn((cb: any) => cb(db)) } as any
    service = new InvitesService(db, invites, tags, roles, mail, config)
  })

  describe("list", () => {
    it("returns [] without extra queries when the org has no invites", async () => {
      invites.listByOrg.mockResolvedValue([])

      const result = await service.list(auth)

      expect(result).toEqual([])
      expect(invites.scopeTagNamesByInviteIds).not.toHaveBeenCalled()
    })

    it("computes status and sorts newest first", async () => {
      invites.listByOrg.mockResolvedValue([
        {
          id: "i1",
          email: "a@x.com",
          acceptedAt: null,
          revokedAt: null,
          expiresAt: new Date(Date.now() + 1000),
          createdAt: new Date("2026-01-01"),
        },
        {
          id: "i2",
          email: "b@x.com",
          acceptedAt: new Date("2026-01-02"),
          revokedAt: null,
          expiresAt: new Date(Date.now() + 1000),
          createdAt: new Date("2026-01-03"),
        },
      ] as any)
      invites.scopeTagNamesByInviteIds.mockResolvedValue([])
      invites.rolesByInviteIds.mockResolvedValue([])

      const result = await service.list(auth)

      expect(result.map((r) => r.id)).toEqual(["i2", "i1"])
      expect(result[0].status).toBe("accepted")
      expect(result[1].status).toBe("pending")
    })
  })

  describe("create", () => {
    it("rejects granting a role the caller can't assign", async () => {
      tags.resolveTagIds.mockResolvedValue(new Map())
      roles.assignableRoles.mockResolvedValue([{ id: "r1", name: "Leader" } as any])

      await expect(
        service.create(auth, { email: "a@x.com", scopeTags: [], roleIds: ["r2"] } as any),
      ).rejects.toThrow(ForbiddenException)
      expect(invites.insert).not.toHaveBeenCalled()
    })

    it("inserts invite + scope tags + roles inside a transaction, then sends mail", async () => {
      tags.resolveTagIds.mockResolvedValue(new Map([["youth", "t1"]]))
      roles.assignableRoles.mockResolvedValue([{ id: "r1", name: "Leader" } as any])
      invites.insert.mockResolvedValue({
        id: "i1",
        email: "a@x.com",
        createdAt: new Date("2026-01-01"),
        expiresAt: new Date("2026-01-08"),
      } as any)

      const result = await service.create(auth, {
        email: "A@X.com",
        scopeTags: ["youth"],
        roleIds: ["r1"],
      } as any)

      expect(db.transaction).toHaveBeenCalled()
      expect(invites.insert).toHaveBeenCalledWith(
        expect.objectContaining({ orgId: auth.orgId, email: "a@x.com", invitedBy: auth.userId }),
        db,
      )
      expect(invites.insertScopeTags).toHaveBeenCalledWith("i1", ["t1"], db)
      expect(invites.insertRoles).toHaveBeenCalledWith("i1", ["r1"], db)
      expect(mail.sendInvite).toHaveBeenCalledWith(
        "a@x.com",
        auth.orgName,
        expect.stringContaining("https://app.example.com/accept-invite?token="),
      )
      expect(result.status).toBe("pending")
      expect(result.roles).toEqual([{ id: "r1", name: "Leader" }])
    })
  })

  describe("revoke", () => {
    it("404s when the invite doesn't exist in this org", async () => {
      invites.revoke.mockResolvedValue(undefined as any)

      await expect(service.revoke(auth, "missing")).rejects.toThrow(NotFoundException)
    })
  })

  describe("preview", () => {
    it("404s for an expired invite", async () => {
      invites.findByTokenHashWithOrg.mockResolvedValue({
        id: "i1",
        email: "a@x.com",
        acceptedAt: null,
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1000),
        orgName: "Grace Church",
      } as any)

      await expect(service.preview("some-token")).rejects.toThrow(NotFoundException)
    })

    it("returns org/roles/scopeTags for a valid pending invite", async () => {
      invites.findByTokenHashWithOrg.mockResolvedValue({
        id: "i1",
        email: "a@x.com",
        acceptedAt: null,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 1000),
        orgName: "Grace Church",
      } as any)
      invites.scopeTagNamesByInviteId.mockResolvedValue([{ name: "youth" }] as any)
      invites.rolesByInviteId.mockResolvedValue([{ id: "r1", name: "Leader" }] as any)

      const result = await service.preview("some-token")

      expect(result).toEqual({
        orgName: "Grace Church",
        email: "a@x.com",
        roles: [{ id: "r1", name: "Leader" }],
        scopeTags: ["youth"],
      })
    })
  })
})
