import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { JwtService } from "@nestjs/jwt"
import type {
  AcceptInviteInput,
  AuthResponse,
  ChangePasswordInput,
  LoginInput,
  MeResponse,
  RegisterInput,
  OrganizationInviteCreateInput,
  OrganizationInviteResponse,
  ResetPasswordInput,
  UpdateProfileInput,
} from "@gembala/shared"
import * as argon2 from "argon2"
import { createHash, randomBytes } from "node:crypto"
import { InjectDb, type Db } from "../db/drizzle.module"
import type { AuthContext } from "../authz/auth-context"
import { AuthContextService } from "../authz/auth-context.service"
import { MailService } from "../mail/mail.service"
import { AuthRepository } from "./auth.repository"

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex")

// Keep byte-identical to the migration's data-migration SQL — see Global
// Constraints in the RBAC implementation plan.
const LEADER_BASELINE_PERMISSIONS = [
  "members:read", "members:create", "members:update",
  "groups:read", "groups:create", "groups:update",
  "households:read", "tags:read", "rooms:read", "events:read",
  "care_requests:read", "care_requests:create", "care_requests:update",
  "journey:read", "journey:create", "journey:update", "courses:read",
]

@Injectable()
export class AuthService {
  constructor(
    @InjectDb() private readonly db: Db,
    private readonly auth: AuthRepository,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
    private readonly authContext: AuthContextService,
  ) {}

  meFromContext(auth: AuthContext): MeResponse {
    return {
      user: { id: auth.userId, name: auth.userName, email: auth.userEmail },
      org: { id: auth.orgId, name: auth.orgName },
      roles: auth.roles,
      isSystemAdmin: auth.isSystemAdmin,
      isPlatformAdmin: this.isPlatformAdmin(auth),
      permissions: [...auth.permissions],
      scopeTags: auth.scopeTagNames,
    }
  }

  private isPlatformAdmin(auth: AuthContext): boolean {
    const emails = this.config.get<string>("PLATFORM_ADMIN_EMAILS", "")
      .split(",").map((email) => email.trim().toLowerCase()).filter(Boolean)
    return auth.isSystemAdmin && emails.includes(auth.userEmail.toLowerCase())
  }

  async createOrganizationInvite(auth: AuthContext, input: OrganizationInviteCreateInput): Promise<OrganizationInviteResponse> {
    if (!this.isPlatformAdmin(auth)) throw new ForbiddenException("platform admin access required")
    const email = input.email.toLowerCase()
    if (await this.auth.findUserIdByEmail(email)) throw new ConflictException("an account with this email already exists")
    const token = randomBytes(32).toString("hex")
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const row = await this.auth.insertOrganizationInvite({ email, tokenHash: sha256(token), invitedBy: auth.userId, expiresAt })
    const url = new URL("/register", this.config.getOrThrow<string>("WEB_ORIGIN"))
    url.searchParams.set("token", token)
    url.searchParams.set("email", email)
    return { id: row.id, email, url: url.toString(), expiresAt: expiresAt.toISOString() }
  }

  async register(input: RegisterInput): Promise<AuthResponse> {
    if (!input.token) throw new UnauthorizedException("an organization invite is required")
    const email = input.email.toLowerCase()
    const existing = await this.auth.findUserIdByEmail(email)
    if (existing) throw new ConflictException("an account with this email already exists")

    const passwordHash = await argon2.hash(input.password)

    const created = await this.db.transaction(async (tx) => {
      const invite = await this.auth.consumeOrganizationInvite(sha256(input.token), email, tx)
      if (!invite) throw new UnauthorizedException("invalid, expired, or already used organization invite")
      const user = await this.auth.insertUser({ email, name: input.name, passwordHash }, tx)
      const org = await this.auth.insertOrganization(input.organizationName, tx)
      const membership = await this.auth.insertMembership(org.id, user.id, tx)
      const adminRole = await this.auth.insertRole(
        { orgId: org.id, name: "Admin", description: "Full access to everything.", isSystemAdmin: true },
        tx,
      )
      const leaderRole = await this.auth.insertRole(
        {
          orgId: org.id,
          name: "Leader",
          description: "Read/write members and groups; read-only elsewhere.",
        },
        tx,
      )
      await this.auth.insertRolePermissions(leaderRole.id, LEADER_BASELINE_PERMISSIONS, tx)
      await this.auth.insertMembershipRole(membership.id, adminRole.id, tx)
      // every org starts with the root directory tag the UI expects
      await this.auth.insertRootDirectoryTag(org.id, tx)
      return { user, org, membership }
    })

    return this.buildAuthResponse(created.user.id)
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    const email = input.email.toLowerCase()
    const user = await this.auth.findUserByEmail(email)
    if (!user || !(await argon2.verify(user.passwordHash, input.password))) {
      throw new UnauthorizedException("invalid email or password")
    }
    return this.buildAuthResponse(user.id)
  }

  async updateProfile(auth: AuthContext, input: UpdateProfileInput): Promise<MeResponse> {
    await this.auth.updateUserName(auth.userId, input.name)
    return this.meFromContext({ ...auth, userName: input.name })
  }

  async changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
    const user = await this.auth.findUserById(userId)
    if (!user) throw new UnauthorizedException("user no longer exists")
    if (!(await argon2.verify(user.passwordHash, input.currentPassword))) {
      throw new BadRequestException("current password is incorrect")
    }
    const passwordHash = await argon2.hash(input.newPassword)
    await this.db.transaction(async (tx) => {
      await this.auth.updateUserPasswordHash(userId, passwordHash, tx)
      // a pending reset link shouldn't outlive a password the user just chose
      await this.auth.burnPasswordResetTokensForUser(userId, tx)
    })
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.auth.findUserByEmail(email.toLowerCase())
    // Always resolve silently — never reveal whether the email exists.
    if (!user) return

    const token = randomBytes(32).toString("hex")
    await this.auth.insertPasswordResetToken({
      userId: user.id,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })

    const webOrigin = this.config.getOrThrow<string>("WEB_ORIGIN")
    await this.mail.sendPasswordReset(user.email, `${webOrigin}/reset-password?token=${token}`)
  }

  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const row = await this.auth.findValidPasswordResetToken(sha256(input.token))
    if (!row) throw new UnauthorizedException("invalid or expired reset link")

    const passwordHash = await argon2.hash(input.password)
    await this.db.transaction(async (tx) => {
      await this.auth.updateUserPasswordHash(row.userId, passwordHash, tx)
      // burn every outstanding token for this user, not just the one used
      await this.auth.burnPasswordResetTokensForUser(row.userId, tx)
    })
  }

  async acceptInvite(input: AcceptInviteInput): Promise<AuthResponse> {
    const invite = await this.auth.findInviteByTokenHash(sha256(input.token))
    if (!invite || invite.revokedAt || invite.acceptedAt || invite.expiresAt < new Date()) {
      throw new UnauthorizedException("invalid or expired invite")
    }

    const email = invite.email.toLowerCase()
    const existing = await this.auth.findUserIdByEmail(email)
    if (existing) {
      throw new ConflictException("this email already has an account")
    }

    const passwordHash = await argon2.hash(input.password)

    const userId = await this.db.transaction(async (tx) => {
      const user = await this.auth.insertUser({ email, name: input.name, passwordHash }, tx)
      const membership = await this.auth.insertMembership(invite.orgId, user.id, tx)
      const scopeRows = await this.auth.inviteScopeTagIds(invite.id, tx)
      await this.auth.insertMembershipScopeTags(
        membership.id,
        scopeRows.map((r) => r.tagId),
        tx,
      )
      const roleRows = await this.auth.inviteRoleIds(invite.id, tx)
      await this.auth.insertMembershipRoles(
        membership.id,
        roleRows.map((r) => r.roleId),
        tx,
      )
      await this.auth.markInviteAccepted(invite.id, tx)
      return user.id
    })

    return this.buildAuthResponse(userId)
  }

  private async buildAuthResponse(userId: string): Promise<AuthResponse> {
    const token = await this.jwt.signAsync({ sub: userId })
    const auth = await this.authContext.load(userId)
    if (!auth) throw new UnauthorizedException("user no longer exists")
    return { token, me: this.meFromContext(auth) }
  }
}
