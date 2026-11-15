import { createHash } from "node:crypto"
import { BadRequestException, ForbiddenException, ConflictException, UnauthorizedException } from "@nestjs/common"
import * as argon2 from "argon2"
import { AuthService } from "./auth.service"
import type { AuthRepository } from "./auth.repository"
import type { JwtService } from "@nestjs/jwt"
import type { ConfigService } from "@nestjs/config"
import type { MailService } from "../mail/mail.service"
import type { AuthContextService } from "../authz/auth-context.service"
import type { Db } from "../db/drizzle.module"

jest.mock("argon2")

function makeRepo(): jest.Mocked<AuthRepository> {
  return {
    insertOrganizationInvite: jest.fn(),
    consumeOrganizationInvite: jest.fn().mockResolvedValue({ id: "invite" }),
    findUserIdByEmail: jest.fn(),
    findUserByEmail: jest.fn(),
    findUserById: jest.fn(),
    findUserByGoogleSub: jest.fn(),
    setUserGoogleSub: jest.fn(),
    updateUserName: jest.fn(),
    insertUser: jest.fn(),
    updateUserPasswordHash: jest.fn(),
    insertOrganization: jest.fn(),
    insertMembership: jest.fn(),
    insertRole: jest.fn(),
    insertRolePermissions: jest.fn(),
    insertMembershipRole: jest.fn(),
    insertMembershipRoles: jest.fn(),
    insertMembershipScopeTags: jest.fn(),
    insertRootDirectoryTag: jest.fn(),
    insertPasswordResetToken: jest.fn(),
    findValidPasswordResetToken: jest.fn(),
    burnPasswordResetTokensForUser: jest.fn(),
    findInviteByTokenHash: jest.fn(),
    inviteScopeTagIds: jest.fn(),
    inviteRoleIds: jest.fn(),
    markInviteAccepted: jest.fn(),
    createSession: jest.fn(),
    createRefreshToken: jest.fn(),
    recordSecurityEvent: jest.fn(),
    consumeRateLimit: jest.fn().mockResolvedValue(true),
    revokeSessionsForUser: jest.fn(),
    revokeSession: jest.fn(),
    findRefreshToken: jest.fn(),
    rotateRefreshToken: jest.fn(),
    touchSession: jest.fn(),
    updateSessionCsrfTokenHash: jest.fn(),
  } as unknown as jest.Mocked<AuthRepository>
}

describe("AuthService", () => {
  let auth: jest.Mocked<AuthRepository>
  let jwt: jest.Mocked<JwtService>
  let config: jest.Mocked<ConfigService>
  let mail: jest.Mocked<MailService>
  let notifications: { notifyUser: jest.Mock; notify: jest.Mock }
  let authContext: jest.Mocked<AuthContextService>
  let db: jest.Mocked<Db>
  let service: AuthService
  let google: { configured: boolean; authUrl: jest.Mock; verifyState: jest.Mock; exchangeCode: jest.Mock }

  beforeEach(() => {
    jest.clearAllMocks()
    auth = makeRepo()
    jwt = { signAsync: jest.fn().mockResolvedValue("jwt-token") } as any
    config = {
      get: jest.fn().mockReturnValue(""),
      getOrThrow: jest.fn((key: string) => ({
        WEB_ORIGIN: "https://app.example.com",
        JWT_SIGNING_KEYS: "default:01234567890123456789012345678901",
        JWT_ACTIVE_KID: "default",
        JWT_ISSUER: "gembala-api",
        JWT_AUDIENCE: "gembala-web",
        JWT_ACCESS_TTL_SECONDS: 900,
        JWT_REFRESH_TTL_SECONDS: 2592000,
        AUTH_LOGIN_RATE_LIMIT: 5,
        AUTH_REFRESH_RATE_LIMIT: 30,
      }[key])),
    } as any
    mail = { sendPasswordReset: jest.fn(), sendInvite: jest.fn() } as any
    authContext = { load: jest.fn() } as any
    db = { transaction: jest.fn((cb: any) => cb(db)) } as any
    notifications = { notifyUser: jest.fn().mockResolvedValue(true), notify: jest.fn().mockResolvedValue(true) }
    google = { configured: true, authUrl: jest.fn(), verifyState: jest.fn().mockResolvedValue({}), exchangeCode: jest.fn() }
    service = new AuthService(db, auth, jwt, config, mail, authContext, notifications as any, google as any)
    ;(argon2.hash as jest.Mock).mockResolvedValue("hashed")
    ;(argon2.verify as jest.Mock).mockResolvedValue(true)
  })

  describe("organization invites", () => {
    const ctx = { userId: "operator", userEmail: "owner@example.com", isSystemAdmin: true } as any

    it("denies ordinary organization admins", async () => {
      await expect(service.createOrganizationInvite(ctx, { email: "new@example.com" })).rejects.toThrow(ForbiddenException)
      expect(auth.insertOrganizationInvite).not.toHaveBeenCalled()
    })

    it("denies allowlisted users without the organization admin role", async () => {
      config.get.mockReturnValue("owner@example.com")
      await expect(service.createOrganizationInvite({ ...ctx, isSystemAdmin: false }, { email: "new@example.com" })).rejects.toThrow(ForbiddenException)
    })

    it("issues an email-bound link and stores only its hash", async () => {
      config.get.mockReturnValue(" OWNER@example.com ")
      auth.insertOrganizationInvite.mockResolvedValue({ id: "invite" } as any)
      const result = await service.createOrganizationInvite(ctx, { email: "NEW@example.com" })
      const token = new URL(result.url).searchParams.get("token")!
      expect(token).toMatch(/^[a-f0-9]{64}$/)
      expect(result.email).toBe("new@example.com")
      expect(auth.insertOrganizationInvite).toHaveBeenCalledWith(expect.objectContaining({
        email: "new@example.com", invitedBy: "operator", tokenHash: expect.not.stringMatching(token),
      }))
      expect(new Date(result.expiresAt).getTime() - Date.now()).toBeGreaterThan(6 * 24 * 60 * 60 * 1000)
    })

    it("rejects invites for existing accounts", async () => {
      config.get.mockReturnValue("owner@example.com")
      auth.findUserIdByEmail.mockResolvedValue({ id: "existing" })
      await expect(service.createOrganizationInvite(ctx, { email: "new@example.com" })).rejects.toThrow(ConflictException)
      expect(auth.insertOrganizationInvite).not.toHaveBeenCalled()
    })
  })

  describe("register", () => {
    it("rejects registration without an invite", async () => {
      await expect(service.register({ email: "a@x.com" } as any)).rejects.toThrow(UnauthorizedException)
      expect(auth.insertUser).not.toHaveBeenCalled()
    })

    it("rejects an invite that cannot be atomically consumed", async () => {
      auth.consumeOrganizationInvite.mockResolvedValue(undefined)
      await expect(service.register({ token: "invalid", email: "a@x.com", password: "password", name: "A", organizationName: "Org" })).rejects.toThrow(UnauthorizedException)
      expect(auth.consumeOrganizationInvite).toHaveBeenCalledWith(expect.any(String), "a@x.com", db)
      expect(auth.insertUser).not.toHaveBeenCalled()
      expect(auth.insertOrganization).not.toHaveBeenCalled()
    })

    it("rejects a duplicate email", async () => {
      auth.findUserIdByEmail.mockResolvedValue({ id: "u1" } as any)

      await expect(
        service.register({
          email: "a@x.com",
          password: "pw",
          name: "A",
          organizationName: "Org",
          token: "invite-token",
        } as any),
      ).rejects.toThrow(ConflictException)
      expect(db.transaction).not.toHaveBeenCalled()
    })

    it("creates user/org/membership/roles/tag inside one transaction", async () => {
      auth.findUserIdByEmail.mockResolvedValue(undefined as any)
      auth.insertUser.mockResolvedValue({ id: "u1" } as any)
      auth.insertOrganization.mockResolvedValue({ id: "org1" } as any)
      auth.insertMembership.mockResolvedValue({ id: "m1" } as any)
      auth.insertRole
        .mockResolvedValueOnce({ id: "admin-role" } as any)
        .mockResolvedValueOnce({ id: "leader-role" } as any)
      authContext.load.mockResolvedValue({
        userId: "u1",
        userName: "A",
        userEmail: "a@x.com",
        orgId: "org1",
        orgName: "Org",
        roles: [],
        isSystemAdmin: true,
        permissions: [],
        scopeTagNames: null,
      } as any)

      await service.register({
        email: "A@X.com",
        password: "pw",
        name: "A",
        organizationName: "Org",
          token: "invite-token",
      } as any)

      expect(db.transaction).toHaveBeenCalled()
      expect(auth.insertUser).toHaveBeenCalledWith(
        { email: "a@x.com", name: "A", passwordHash: "hashed" },
        db,
      )
      expect(auth.insertMembershipRole).toHaveBeenCalledWith("m1", "admin-role", db)
      expect(auth.insertRolePermissions).toHaveBeenCalledWith("leader-role", expect.any(Array), db)
      expect(auth.insertRootDirectoryTag).toHaveBeenCalledWith("org1", db)
      expect(jwt.signAsync).toHaveBeenCalledWith(expect.objectContaining({ sub: "u1", sid: expect.any(String) }), expect.any(Object))
    })
  })

  describe("login", () => {
    it("rejects an unknown email", async () => {
      auth.findUserByEmail.mockResolvedValue(undefined as any)

      await expect(service.login({ email: "a@x.com", password: "pw" } as any)).rejects.toThrow(
        UnauthorizedException,
      )
    })

    it("rejects a wrong password", async () => {
      auth.findUserByEmail.mockResolvedValue({ id: "u1", passwordHash: "hashed" } as any)
      ;(argon2.verify as jest.Mock).mockResolvedValue(false)

      await expect(service.login({ email: "a@x.com", password: "wrong" } as any)).rejects.toThrow(
        UnauthorizedException,
      )
    })
  })

  describe("forgotPassword", () => {
    it("resolves silently for an unknown email, sending no mail", async () => {
      auth.findUserByEmail.mockResolvedValue(undefined as any)

      await service.forgotPassword("nobody@x.com")

      expect(auth.insertPasswordResetToken).not.toHaveBeenCalled()
      expect(mail.sendPasswordReset).not.toHaveBeenCalled()
    })

    it("stores a hashed token and emails the reset link", async () => {
      auth.findUserByEmail.mockResolvedValue({ id: "u1", email: "a@x.com" } as any)

      await service.forgotPassword("A@X.com")

      expect(auth.insertPasswordResetToken).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "u1" }),
      )
      expect(mail.sendPasswordReset).toHaveBeenCalledWith(
        "a@x.com",
        expect.stringContaining("https://app.example.com/reset-password?token="),
      )
    })
  })

  describe("resetPassword", () => {
    it("rejects an invalid/expired token", async () => {
      auth.findValidPasswordResetToken.mockResolvedValue(undefined as any)

      await expect(service.resetPassword({ token: "t", password: "pw" } as any)).rejects.toThrow(
        UnauthorizedException,
      )
    })

    it("updates the password and burns every outstanding token", async () => {
      auth.findValidPasswordResetToken.mockResolvedValue({ userId: "u1" } as any)

      await service.resetPassword({ token: "t", password: "newpw" } as any)

      expect(db.transaction).toHaveBeenCalled()
      expect(auth.updateUserPasswordHash).toHaveBeenCalledWith("u1", "hashed", db)
      expect(auth.burnPasswordResetTokensForUser).toHaveBeenCalledWith("u1", db)
    })

    it("queues a security notification in the same transaction", async () => {
      auth.findUserById.mockResolvedValue({ id: "u1", passwordHash: "old" } as any)
      await service.changePassword("u1", { currentPassword: "old", newPassword: "newpassword" })
      expect(notifications.notifyUser).toHaveBeenCalledWith(
        expect.objectContaining({ type: "security.password_changed", userId: "u1", payload: {} }),
        db,
      )
    })
  })

  describe("changePassword", () => {
    it("rejects a wrong current password without touching the hash", async () => {
      auth.findUserById.mockResolvedValue({ id: "u1", passwordHash: "old" } as any)
      ;(argon2.verify as jest.Mock).mockResolvedValue(false)

      await expect(
        service.changePassword("u1", { currentPassword: "nope", newPassword: "newpassword" }),
      ).rejects.toThrow(BadRequestException)
      expect(auth.updateUserPasswordHash).not.toHaveBeenCalled()
    })

    it("updates the hash and burns outstanding reset tokens", async () => {
      auth.findUserById.mockResolvedValue({ id: "u1", passwordHash: "old" } as any)

      await service.changePassword("u1", { currentPassword: "old", newPassword: "newpassword" })

      expect(auth.updateUserPasswordHash).toHaveBeenCalledWith("u1", "hashed", db)
      expect(auth.burnPasswordResetTokensForUser).toHaveBeenCalledWith("u1", db)
    })
  })

  describe("updateProfile", () => {
    it("persists the name and returns the refreshed me", async () => {
      const ctx = {
        userId: "u1", userName: "Old", userEmail: "a@b.c", orgId: "o", orgName: "Org",
        roles: [], isSystemAdmin: false, permissions: new Set<string>(), scopeTagNames: null,
      } as any

      const me = await service.updateProfile(ctx, { name: "New" })

      expect(auth.updateUserName).toHaveBeenCalledWith("u1", "New")
      expect(me.user.name).toBe("New")
    })
  })

  describe("acceptInvite", () => {
    it("rejects an expired invite", async () => {
      auth.findInviteByTokenHash.mockResolvedValue({
        id: "i1",
        email: "a@x.com",
        revokedAt: null,
        acceptedAt: null,
        expiresAt: new Date(Date.now() - 1000),
        orgId: "org1",
      } as any)

      await expect(service.acceptInvite({ token: "t", name: "A", password: "pw" } as any)).rejects.toThrow(
        UnauthorizedException,
      )
    })

    it("rejects when an account already exists for the invite's email", async () => {
      auth.findInviteByTokenHash.mockResolvedValue({
        id: "i1",
        email: "a@x.com",
        revokedAt: null,
        acceptedAt: null,
        expiresAt: new Date(Date.now() + 1000),
        orgId: "org1",
      } as any)
      auth.findUserIdByEmail.mockResolvedValue({ id: "existing" } as any)

      await expect(service.acceptInvite({ token: "t", name: "A", password: "pw" } as any)).rejects.toThrow(
        ConflictException,
      )
    })

    it("creates the membership with invite scope tags and roles, then marks accepted", async () => {
      auth.findInviteByTokenHash.mockResolvedValue({
        id: "i1",
        email: "a@x.com",
        revokedAt: null,
        acceptedAt: null,
        expiresAt: new Date(Date.now() + 1000),
        orgId: "org1",
      } as any)
      auth.findUserIdByEmail.mockResolvedValue(undefined as any)
      auth.insertUser.mockResolvedValue({ id: "u1" } as any)
      auth.insertMembership.mockResolvedValue({ id: "m1" } as any)
      auth.inviteScopeTagIds.mockResolvedValue([{ tagId: "t1" }] as any)
      auth.inviteRoleIds.mockResolvedValue([{ roleId: "r1" }] as any)
      authContext.load.mockResolvedValue({
        userId: "u1",
        userName: "A",
        userEmail: "a@x.com",
        orgId: "org1",
        orgName: "Org",
        roles: [],
        isSystemAdmin: false,
        permissions: [],
        scopeTagNames: [],
      } as any)

      await service.acceptInvite({ token: "t", name: "A", password: "pw" } as any)

      expect(auth.insertMembershipScopeTags).toHaveBeenCalledWith("m1", ["t1"], db)
      expect(auth.insertMembershipRoles).toHaveBeenCalledWith("m1", ["r1"], db)
      expect(auth.markInviteAccepted).toHaveBeenCalledWith("i1", db)
      expect(notifications.notify).not.toHaveBeenCalled() // invite had no inviter
    })

    it("tells the inviter when the invite is accepted", async () => {
      auth.findInviteByTokenHash.mockResolvedValue({ id: "i1", email: "a@x.com", revokedAt: null, acceptedAt: null, expiresAt: new Date(Date.now() + 1000), orgId: "org1", invitedBy: "boss" } as any)
      auth.findUserIdByEmail.mockResolvedValue(undefined as any)
      auth.insertUser.mockResolvedValue({ id: "u1" } as any)
      auth.insertMembership.mockResolvedValue({ id: "m1" } as any)
      auth.inviteScopeTagIds.mockResolvedValue([] as any)
      auth.inviteRoleIds.mockResolvedValue([] as any)
      authContext.load.mockResolvedValue({ userId: "u1", userName: "A", userEmail: "a@x.com", orgId: "org1", orgName: "Org", roles: [], isSystemAdmin: false, permissions: [], scopeTagNames: [] } as any)
      await service.acceptInvite({ token: "t", name: "Ana", password: "pw" } as any)
      expect(notifications.notify).toHaveBeenCalledWith(
        { type: "invite.accepted", orgId: "org1", recipients: ["boss"], payload: { inviteeName: "Ana" }, idempotencyKey: "invite_accepted:i1" },
        db,
      )
    })
  })

  const sha256 = (v: string) => createHash("sha256").update(v).digest("hex")

  describe("refresh token reuse", () => {
    const sha = (v: string) => createHash("sha256").update(v).digest("hex")
    const future = new Date(Date.now() + 60_000)
    const row = (refresh: object = {}) => ({
      refresh: { id: "rt1", tokenHash: "h", expiresAt: future, rotatedAt: null, revokedAt: null, ...refresh },
      session: { id: "s1", userId: "u1", revokedAt: null, expiresAt: future, csrfTokenHash: sha("csrf") },
      user: { authStatus: "active" },
    })
    beforeEach(() => {
      auth.consumeRateLimit.mockResolvedValue(true)
      ;(argon2.verify as jest.Mock).mockResolvedValue(true)
    })

    it("a concurrent rotation that loses is rejected without revoking the session or alerting", async () => {
      auth.findRefreshToken.mockResolvedValue(row() as any)
      auth.rotateRefreshToken.mockResolvedValue(undefined as any) // the other request rotated it first
      await expect(service.refresh("rt1.secret", "csrf")).rejects.toThrow("invalid or expired authentication session")
      expect(auth.revokeSession).not.toHaveBeenCalled()
      expect(notifications.notifyUser).not.toHaveBeenCalled()
    })

    it("replaying an already-rotated token revokes the session and alerts the user", async () => {
      auth.findRefreshToken.mockResolvedValue(row({ rotatedAt: new Date() }) as any)
      await expect(service.refresh("rt1.secret", "csrf")).rejects.toThrow("invalid or expired authentication session")
      expect(auth.revokeSession).toHaveBeenCalledWith("s1", "refresh_token_reuse", db)
      expect(notifications.notifyUser).toHaveBeenCalledWith(expect.objectContaining({ type: "security.refresh_reuse", userId: "u1" }), db)
    })
  })

  describe("googleSignIn", () => {
    const profile = { sub: "g-1", email: "jane@example.com", emailVerified: true, name: "Jane" }
    const input = { code: "code", state: "state", cookieState: "state" }
    const invite = { id: "inv1", orgId: "org1", email: "Jane@Example.com", invitedBy: null, revokedAt: null, acceptedAt: null, expiresAt: new Date(Date.now() + 60_000) }
    beforeEach(() => {
      google.exchangeCode.mockResolvedValue({ profile })
      authContext.load.mockResolvedValue({ userId: "u1", userEmail: profile.email, permissions: new Set(), roles: [] } as any)
    })

    it("signs in a user already linked to the Google account", async () => {
      auth.findUserByGoogleSub.mockResolvedValue({ id: "u1", authStatus: "active" } as any)
      const session = await service.googleSignIn(input)
      expect(session.response.accessToken).toBe("jwt-token")
      expect(auth.setUserGoogleSub).not.toHaveBeenCalled()
      expect(auth.recordSecurityEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "login_succeeded", metadata: { method: "google" } }), db)
    })

    it("links an existing account by verified email", async () => {
      auth.findUserByEmail.mockResolvedValue({ id: "u1", authStatus: "active", googleSub: null } as any)
      await service.googleSignIn(input)
      expect(auth.setUserGoogleSub).toHaveBeenCalledWith("u1", "g-1")
    })

    it("refuses an unverified Google email before looking up any account", async () => {
      google.exchangeCode.mockResolvedValue({ profile: { ...profile, emailVerified: false } })
      await expect(service.googleSignIn(input)).rejects.toMatchObject({ code: "unverified" })
      expect(auth.findUserByEmail).not.toHaveBeenCalled()
    })

    it("refuses an email already linked to another Google account", async () => {
      auth.findUserByEmail.mockResolvedValue({ id: "u1", authStatus: "active", googleSub: "other" } as any)
      await expect(service.googleSignIn(input)).rejects.toMatchObject({ code: "failed" })
      expect(auth.setUserGoogleSub).not.toHaveBeenCalled()
    })

    it("never creates an account without an invite", async () => {
      await expect(service.googleSignIn(input)).rejects.toMatchObject({ code: "no_account" })
      expect(auth.insertUser).not.toHaveBeenCalled()
    })

    it("fails when the state does not verify", async () => {
      google.verifyState.mockRejectedValue(new Error("bad state"))
      await expect(service.googleSignIn(input)).rejects.toMatchObject({ code: "failed" })
      expect(google.exchangeCode).not.toHaveBeenCalled()
    })

    it("refuses an invite addressed to a different email", async () => {
      google.verifyState.mockResolvedValue({ invite: "tok" })
      auth.findInviteByTokenHash.mockResolvedValue({ ...invite, email: "someone@else.com" } as any)
      await expect(service.googleSignIn(input)).rejects.toMatchObject({ code: "email_mismatch" })
      expect(auth.insertUser).not.toHaveBeenCalled()
    })

    it("redeems a matching invite into a password-less account", async () => {
      google.verifyState.mockResolvedValue({ invite: "tok" })
      auth.findInviteByTokenHash.mockResolvedValue(invite as any)
      auth.insertUser.mockResolvedValue({ id: "u1" } as any)
      auth.insertMembership.mockResolvedValue({ id: "m1" } as any)
      auth.inviteScopeTagIds.mockResolvedValue([{ tagId: "t1" }] as any)
      auth.inviteRoleIds.mockResolvedValue([{ roleId: "r1" }] as any)
      await service.googleSignIn(input)
      expect(auth.insertUser).toHaveBeenCalledWith({ email: profile.email, name: "Jane", passwordHash: null, googleSub: "g-1" }, db)
      expect(auth.insertMembershipRoles).toHaveBeenCalledWith("m1", ["r1"], db)
      expect(auth.markInviteAccepted).toHaveBeenCalledWith("inv1", db)
    })
  })

  describe("password-less accounts", () => {
    it("cannot log in with a password", async () => {
      auth.findUserByEmail.mockResolvedValue({ id: "u1", authStatus: "active", passwordHash: null } as any)
      await expect(service.login({ email: "jane@example.com", password: "x" })).rejects.toThrow(UnauthorizedException)
      expect(argon2.verify).not.toHaveBeenCalled()
    })

    it("are pointed to the reset flow when changing password", async () => {
      auth.findUserById.mockResolvedValue({ id: "u1", passwordHash: null } as any)
      await expect(service.changePassword("u1", { currentPassword: "x", newPassword: "longenough1" })).rejects.toThrow(BadRequestException)
    })
  })
})
