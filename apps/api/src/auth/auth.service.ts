import { BadRequestException, ConflictException, ForbiddenException, HttpException, Injectable, UnauthorizedException } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { JwtService } from "@nestjs/jwt"
import type { AcceptInviteInput, AuthResponse, ChangePasswordInput, LoginInput, MeResponse, RegisterInput, OrganizationInviteCreateInput, OrganizationInviteResponse, ResetPasswordInput, UpdateProfileInput } from "@gembala/shared"
import * as argon2 from "argon2"
import { createHash, randomBytes, randomUUID } from "node:crypto"
import { InjectDb, type Db } from "../db/drizzle.module"
import type { AuthContext } from "../authz/auth-context"
import { AuthContextService } from "../authz/auth-context.service"
import { MailService } from "../mail/mail.service"
import { AuthRepository, type RequestMetadata } from "./auth.repository"

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex")
const opaqueSecret = () => randomBytes(48).toString("base64url")
const unauthorized = () => new UnauthorizedException("invalid or expired authentication session")
const LEADER_BASELINE_PERMISSIONS = ["members:read", "members:create", "members:update", "groups:read", "groups:create", "groups:update", "households:read", "tags:read", "rooms:read", "events:read", "care_requests:read", "care_requests:create", "care_requests:update", "journey:read", "journey:create", "journey:update", "courses:read"]

export type AuthenticatedSession = { response: AuthResponse; refreshToken: string }

@Injectable()
export class AuthService {
  constructor(@InjectDb() private readonly db: Db, private readonly auth: AuthRepository, private readonly jwt: JwtService, private readonly config: ConfigService, private readonly mail: MailService, private readonly authContext: AuthContextService) {}

  private keys(): Map<string, string> {
    const keys = new Map(this.config.getOrThrow<string>("JWT_SIGNING_KEYS").split(",").map((entry) => {
      const separator = entry.indexOf(":")
      return [entry.slice(0, separator).trim(), entry.slice(separator + 1).trim()]
    }))
    const active = this.config.getOrThrow<string>("JWT_ACTIVE_KID")
    if (!keys.get(active) || [...keys.values()].some((secret) => secret.length < 32)) throw new Error("invalid JWT signing-key configuration")
    return keys
  }

  jwtVerificationKey(kid: string): string | undefined { return this.keys().get(kid) }

  async validateAccessSession(userId: string, sessionId: string): Promise<boolean> {
    const row = await this.auth.findActiveSession(sessionId, userId)
    return Boolean(row && row.authStatus === "active")
  }

  private async assertRateLimit(key: string, limit: number) {
    if (!(await this.auth.consumeRateLimit(key, limit, 60_000))) throw new HttpException("too many authentication attempts", 429)
  }

  meFromContext(auth: AuthContext): MeResponse {
    return { user: { id: auth.userId, name: auth.userName, email: auth.userEmail }, org: { id: auth.orgId, name: auth.orgName }, roles: auth.roles, isSystemAdmin: auth.isSystemAdmin, isPlatformAdmin: this.isPlatformAdmin(auth), permissions: [...auth.permissions], scopeTags: auth.scopeTagNames }
  }

  private isPlatformAdmin(auth: AuthContext): boolean {
    const emails = this.config.get<string>("PLATFORM_ADMIN_EMAILS", "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean)
    return auth.isSystemAdmin && emails.includes(auth.userEmail.toLowerCase())
  }

  async createOrganizationInvite(auth: AuthContext, input: OrganizationInviteCreateInput): Promise<OrganizationInviteResponse> {
    if (!this.isPlatformAdmin(auth)) throw new ForbiddenException("platform admin access required")
    const email = input.email.toLowerCase()
    if (await this.auth.findUserIdByEmail(email)) throw new ConflictException("an account with this email already exists")
    const token = randomBytes(32).toString("hex"); const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const row = await this.auth.insertOrganizationInvite({ email, tokenHash: sha256(token), invitedBy: auth.userId, expiresAt })
    const url = new URL("/register", this.config.getOrThrow<string>("WEB_ORIGIN")); url.searchParams.set("token", token); url.searchParams.set("email", email)
    return { id: row.id, email, url: url.toString(), expiresAt: expiresAt.toISOString() }
  }

  async register(input: RegisterInput, metadata: RequestMetadata = {}): Promise<AuthenticatedSession> {
    if (!input.token) throw new UnauthorizedException("an organization invite is required")
    const email = input.email.toLowerCase()
    if (await this.auth.findUserIdByEmail(email)) throw new ConflictException("an account with this email already exists")
    const passwordHash = await argon2.hash(input.password)
    const user = await this.db.transaction(async (tx) => {
      const invite = await this.auth.consumeOrganizationInvite(sha256(input.token), email, tx)
      if (!invite) throw new UnauthorizedException("invalid, expired, or already used organization invite")
      const created = await this.auth.insertUser({ email, name: input.name, passwordHash }, tx)
      const org = await this.auth.insertOrganization(input.organizationName, tx); await this.auth.insertDefaultJourneyStages?.(org.id, tx); const membership = await this.auth.insertMembership(org.id, created.id, tx)
      const admin = await this.auth.insertRole({ orgId: org.id, name: "Admin", description: "Full access to everything.", isSystemAdmin: true }, tx)
      const leader = await this.auth.insertRole({ orgId: org.id, name: "Leader", description: "Read/write members and groups; read-only elsewhere." }, tx)
      await this.auth.insertRolePermissions(leader.id, LEADER_BASELINE_PERMISSIONS, tx); await this.auth.insertMembershipRole(membership.id, admin.id, tx); await this.auth.insertRootDirectoryTag(org.id, tx)
      return created
    })
    return this.issueSession(user.id, metadata)
  }

  async login(input: LoginInput, metadata: RequestMetadata = {}): Promise<AuthenticatedSession> {
    const email = input.email.toLowerCase()
    await this.assertRateLimit(`login:${metadata.ipAddress ?? "unknown"}:${sha256(email)}`, this.config.getOrThrow<number>("AUTH_LOGIN_RATE_LIMIT"))
    const user = await this.auth.findUserByEmail(email)
    if (!user || user.authStatus !== "active" || !(await argon2.verify(user.passwordHash, input.password))) {
      await this.auth.recordSecurityEvent({ type: "login_failed", ...metadata, metadata: { emailHash: sha256(email) } })
      throw new UnauthorizedException("invalid email or password")
    }
    return this.issueSession(user.id, metadata)
  }

  async csrf(refreshToken: string | undefined): Promise<{ csrfToken: string }> {
    const { row } = await this.validRefreshToken(refreshToken)
    const csrfToken = opaqueSecret()
    await this.auth.updateSessionCsrfTokenHash(row.session.id, sha256(csrfToken))
    // CORS and origin validation ensure only the configured SPA can read this response.
    return { csrfToken }
  }

  async refresh(refreshToken: string | undefined, csrfToken: string | undefined, metadata: RequestMetadata = {}): Promise<AuthenticatedSession> {
    await this.assertRateLimit(`refresh:${metadata.ipAddress ?? "unknown"}`, this.config.getOrThrow<number>("AUTH_REFRESH_RATE_LIMIT"))
    const token = await this.validRefreshToken(refreshToken)
    if (!csrfToken || sha256(csrfToken) !== token.row.session.csrfTokenHash) throw unauthorized()
    return this.db.transaction(async (tx) => {
      if (!(await this.auth.rotateRefreshToken(token.row.refresh.id, tx))) {
        await this.revokeForReuse(token.row.session.userId, token.row.session.id, metadata, tx); throw unauthorized()
      }
      const id = randomUUID(); const secret = opaqueSecret()
      await this.auth.createRefreshToken({ id, sessionId: token.row.session.id, tokenHash: await argon2.hash(secret), expiresAt: token.row.session.expiresAt }, tx)
      await this.auth.touchSession(token.row.session.id, tx)
      await this.auth.recordSecurityEvent({ type: "refresh_succeeded", userId: token.row.session.userId, sessionId: token.row.session.id, ...metadata }, tx)
      return { response: await this.buildAuthResponse(token.row.session.userId, token.row.session.id), refreshToken: `${id}.${secret}` }
    })
  }

  async logout(userId: string, sessionId: string, metadata: RequestMetadata = {}) { await this.db.transaction(async (tx) => { await this.auth.revokeSession(sessionId, "logout", tx); await this.auth.recordSecurityEvent({ type: "logout", userId, sessionId, ...metadata }, tx) }) }
  async logoutAll(userId: string, metadata: RequestMetadata = {}) { await this.db.transaction(async (tx) => { await this.auth.revokeSessionsForUser(userId, "logout_all", tx); await this.auth.recordSecurityEvent({ type: "logout_all", userId, ...metadata }, tx) }) }
  async updateProfile(auth: AuthContext, input: UpdateProfileInput): Promise<MeResponse> { await this.auth.updateUserName(auth.userId, input.name); return this.meFromContext({ ...auth, userName: input.name }) }

  async changePassword(userId: string, input: ChangePasswordInput, metadata: RequestMetadata = {}): Promise<void> {
    const user = await this.auth.findUserById(userId); if (!user) throw new UnauthorizedException("user no longer exists")
    if (!(await argon2.verify(user.passwordHash, input.currentPassword))) throw new BadRequestException("current password is incorrect")
    await this.db.transaction(async (tx) => { await this.auth.updateUserPasswordHash(userId, await argon2.hash(input.newPassword), tx); await this.auth.burnPasswordResetTokensForUser(userId, tx); await this.auth.revokeSessionsForUser(userId, "password_changed", tx); await this.auth.recordSecurityEvent({ type: "password_changed", userId, ...metadata }, tx) })
  }

  async forgotPassword(email: string, metadata: RequestMetadata = {}): Promise<void> {
    await this.assertRateLimit(`password:${metadata.ipAddress ?? "unknown"}:${sha256(email.toLowerCase())}`, this.config.getOrThrow<number>("AUTH_PASSWORD_RATE_LIMIT"))
    const user = await this.auth.findUserByEmail(email.toLowerCase()); if (!user) return
    const token = randomBytes(32).toString("hex")
    await this.auth.insertPasswordResetToken({ userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 60 * 60 * 1000) })
    await this.mail.sendPasswordReset(user.email, `${this.config.getOrThrow<string>("WEB_ORIGIN")}/reset-password?token=${token}`)
  }

  async resetPassword(input: ResetPasswordInput, metadata: RequestMetadata = {}): Promise<void> {
    await this.assertRateLimit(`password-reset:${metadata.ipAddress ?? "unknown"}`, this.config.getOrThrow<number>("AUTH_PASSWORD_RATE_LIMIT"))
    const row = await this.auth.findValidPasswordResetToken(sha256(input.token)); if (!row) throw new UnauthorizedException("invalid or expired reset link")
    await this.db.transaction(async (tx) => { await this.auth.updateUserPasswordHash(row.userId, await argon2.hash(input.password), tx); await this.auth.burnPasswordResetTokensForUser(row.userId, tx); await this.auth.revokeSessionsForUser(row.userId, "password_reset", tx); await this.auth.recordSecurityEvent({ type: "password_reset", userId: row.userId, ...metadata }, tx) })
  }

  async acceptInvite(input: AcceptInviteInput, metadata: RequestMetadata = {}): Promise<AuthenticatedSession> {
    const invite = await this.auth.findInviteByTokenHash(sha256(input.token)); if (!invite || invite.revokedAt || invite.acceptedAt || invite.expiresAt < new Date()) throw new UnauthorizedException("invalid or expired invite")
    const email = invite.email.toLowerCase(); if (await this.auth.findUserIdByEmail(email)) throw new ConflictException("this email already has an account")
    const userId = await this.db.transaction(async (tx) => { const user = await this.auth.insertUser({ email, name: input.name, passwordHash: await argon2.hash(input.password) }, tx); const membership = await this.auth.insertMembership(invite.orgId, user.id, tx); await this.auth.insertMembershipScopeTags(membership.id, (await this.auth.inviteScopeTagIds(invite.id, tx)).map((row) => row.tagId), tx); await this.auth.insertMembershipRoles(membership.id, (await this.auth.inviteRoleIds(invite.id, tx)).map((row) => row.roleId), tx); await this.auth.markInviteAccepted(invite.id, tx); return user.id })
    return this.issueSession(userId, metadata)
  }

  private async issueSession(userId: string, metadata: RequestMetadata): Promise<AuthenticatedSession> {
    const sessionId = randomUUID(); const refreshId = randomUUID(); const refreshSecret = opaqueSecret(); const csrfToken = opaqueSecret(); const expiresAt = new Date(Date.now() + this.config.getOrThrow<number>("JWT_REFRESH_TTL_SECONDS") * 1000)
    await this.db.transaction(async (tx) => { await this.auth.createSession({ id: sessionId, userId, csrfTokenHash: sha256(csrfToken), expiresAt, ...metadata }, tx); await this.auth.createRefreshToken({ id: refreshId, sessionId, tokenHash: await argon2.hash(refreshSecret), expiresAt }, tx); await this.auth.recordSecurityEvent({ type: "login_succeeded", userId, sessionId, ...metadata }, tx) })
    return { response: await this.buildAuthResponse(userId, sessionId), refreshToken: `${refreshId}.${refreshSecret}` }
  }

  private async buildAuthResponse(userId: string, sessionId: string): Promise<AuthResponse> {
    const auth = await this.authContext.load(userId); if (!auth) throw unauthorized()
    const kid = this.config.getOrThrow<string>("JWT_ACTIVE_KID")
    const accessToken = await this.jwt.signAsync({ sub: userId, sid: sessionId, jti: randomUUID() }, { secret: this.jwtVerificationKey(kid), algorithm: "HS256", header: { kid, alg: "HS256" }, issuer: this.config.getOrThrow<string>("JWT_ISSUER"), audience: this.config.getOrThrow<string>("JWT_AUDIENCE"), expiresIn: this.config.getOrThrow<number>("JWT_ACCESS_TTL_SECONDS") })
    return { accessToken, me: this.meFromContext(auth) }
  }

  private async validRefreshToken(raw: string | undefined) {
    const [id, secret, extra] = raw?.split(".") ?? []; if (!id || !secret || extra) throw unauthorized()
    const row = await this.auth.findRefreshToken(id)
    if (!row || !(await argon2.verify(row.refresh.tokenHash, secret))) throw unauthorized()
    if (row.session.revokedAt || row.session.expiresAt <= new Date() || row.refresh.expiresAt <= new Date() || row.user.authStatus !== "active") throw unauthorized()
    if (row.refresh.rotatedAt || row.refresh.revokedAt) { await this.db.transaction((tx) => this.revokeForReuse(row.session.userId, row.session.id, {}, tx)); throw unauthorized() }
    return { row }
  }

  private async revokeForReuse(userId: string, sessionId: string, metadata: RequestMetadata, tx: Db) { await this.auth.revokeSession(sessionId, "refresh_token_reuse", tx); await this.auth.recordSecurityEvent({ type: "refresh_reuse_detected", userId, sessionId, ...metadata }, tx) }
}
