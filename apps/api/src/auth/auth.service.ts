import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { JwtService } from "@nestjs/jwt"
import type {
  AcceptInviteInput,
  AuthResponse,
  LoginInput,
  MeResponse,
  RegisterInput,
  ResetPasswordInput,
} from "@gembala/shared"
import * as argon2 from "argon2"
import { createHash, randomBytes } from "node:crypto"
import { and, eq, gt, isNull } from "drizzle-orm"
import { InjectDb, type Db } from "../db/drizzle.module"
import {
  invites,
  inviteRoles,
  inviteScopeTags,
  membershipRoles,
  membershipScopeTags,
  organizations,
  orgMemberships,
  passwordResetTokens,
  roles,
  rolePermissions,
  tags,
  users,
} from "../db/schema"
import type { AuthContext } from "../authz/auth-context"
import { AuthContextService } from "../authz/auth-context.service"
import { MailService } from "../mail/mail.service"

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex")

// Keep byte-identical to the migration's data-migration SQL — see Global
// Constraints in the RBAC implementation plan.
const LEADER_BASELINE_PERMISSIONS = [
  "members:read", "members:create", "members:update",
  "groups:read", "groups:create", "groups:update",
  "households:read", "tags:read", "rooms:read", "events:read",
]

@Injectable()
export class AuthService {
  constructor(
    @InjectDb() private readonly db: Db,
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
      permissions: [...auth.permissions],
      scopeTags: auth.scopeTagNames,
    }
  }

  async register(input: RegisterInput): Promise<AuthResponse> {
    const email = input.email.toLowerCase()
    const existing = await this.db.select({ id: users.id }).from(users).where(eq(users.email, email))
    if (existing.length > 0) throw new ConflictException("an account with this email already exists")

    const passwordHash = await argon2.hash(input.password)

    const created = await this.db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({ email, name: input.name, passwordHash })
        .returning()
      const [org] = await tx
        .insert(organizations)
        .values({ name: input.organizationName })
        .returning()
      const [membership] = await tx
        .insert(orgMemberships)
        .values({ orgId: org.id, userId: user.id })
        .returning()
      const [adminRole] = await tx
        .insert(roles)
        .values({ orgId: org.id, name: "Admin", description: "Full access to everything.", isSystemAdmin: true })
        .returning()
      const [leaderRole] = await tx
        .insert(roles)
        .values({ orgId: org.id, name: "Leader", description: "Read/write members and groups; read-only elsewhere." })
        .returning()
      await tx.insert(rolePermissions).values(
        LEADER_BASELINE_PERMISSIONS.map((permission) => ({ roleId: leaderRole.id, permission })),
      )
      await tx.insert(membershipRoles).values({ membershipId: membership.id, roleId: adminRole.id })
      // every org starts with the root directory tag the UI expects
      await tx.insert(tags).values({ orgId: org.id, name: "members", description: "Everyone in the church directory" })
      return { user, org, membership }
    })

    return this.buildAuthResponse(created.user.id)
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    const email = input.email.toLowerCase()
    const [user] = await this.db.select().from(users).where(eq(users.email, email))
    if (!user || !(await argon2.verify(user.passwordHash, input.password))) {
      throw new UnauthorizedException("invalid email or password")
    }
    return this.buildAuthResponse(user.id)
  }

  async forgotPassword(email: string): Promise<void> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
    // Always resolve silently — never reveal whether the email exists.
    if (!user) return

    const token = randomBytes(32).toString("hex")
    await this.db.insert(passwordResetTokens).values({
      userId: user.id,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })

    const webOrigin = this.config.getOrThrow<string>("WEB_ORIGIN")
    await this.mail.sendPasswordReset(user.email, `${webOrigin}/reset-password?token=${token}`)
  }

  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const [row] = await this.db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.tokenHash, sha256(input.token)),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, new Date()),
        ),
      )
    if (!row) throw new UnauthorizedException("invalid or expired reset link")

    const passwordHash = await argon2.hash(input.password)
    await this.db.transaction(async (tx) => {
      await tx.update(users).set({ passwordHash }).where(eq(users.id, row.userId))
      // burn every outstanding token for this user, not just the one used
      await tx
        .update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(and(eq(passwordResetTokens.userId, row.userId), isNull(passwordResetTokens.usedAt)))
    })
  }

  async acceptInvite(input: AcceptInviteInput): Promise<AuthResponse> {
    const [invite] = await this.db
      .select()
      .from(invites)
      .where(eq(invites.tokenHash, sha256(input.token)))
    if (!invite || invite.revokedAt || invite.acceptedAt || invite.expiresAt < new Date()) {
      throw new UnauthorizedException("invalid or expired invite")
    }

    const email = invite.email.toLowerCase()
    const existing = await this.db.select({ id: users.id }).from(users).where(eq(users.email, email))
    if (existing.length > 0) {
      throw new ConflictException("this email already has an account")
    }

    const passwordHash = await argon2.hash(input.password)

    const userId = await this.db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({ email, name: input.name, passwordHash })
        .returning()
      const [membership] = await tx
        .insert(orgMemberships)
        .values({ orgId: invite.orgId, userId: user.id })
        .returning()
      const scopeRows = await tx
        .select({ tagId: inviteScopeTags.tagId })
        .from(inviteScopeTags)
        .where(eq(inviteScopeTags.inviteId, invite.id))
      if (scopeRows.length > 0) {
        await tx.insert(membershipScopeTags).values(
          scopeRows.map((r) => ({ membershipId: membership.id, tagId: r.tagId })),
        )
      }
      const roleRows = await tx
        .select({ roleId: inviteRoles.roleId })
        .from(inviteRoles)
        .where(eq(inviteRoles.inviteId, invite.id))
      if (roleRows.length > 0) {
        await tx.insert(membershipRoles).values(
          roleRows.map((r) => ({ membershipId: membership.id, roleId: r.roleId })),
        )
      }
      await tx.update(invites).set({ acceptedAt: new Date() }).where(eq(invites.id, invite.id))
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
