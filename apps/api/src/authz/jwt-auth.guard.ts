import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common"
import { Reflector } from "@nestjs/core"
import { JwtService } from "@nestjs/jwt"
import { eq } from "drizzle-orm"
import type { Request } from "express"
import { DRIZZLE, InjectDb, type Db } from "../db/drizzle.module"
import {
  membershipScopeTags,
  organizations,
  orgMemberships,
  tags,
  users,
} from "../db/schema"
import type { AuthContext } from "./auth-context"
import { IS_PUBLIC_KEY } from "./decorators"

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    @InjectDb() private readonly db: Db,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ])
    if (isPublic) return true

    const req = ctx.switchToHttp().getRequest<Request & { auth?: AuthContext }>()
    const header = req.headers.authorization
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined
    if (!token) throw new UnauthorizedException("missing bearer token")

    let payload: { sub: string }
    try {
      payload = await this.jwt.verifyAsync<{ sub: string }>(token)
    } catch {
      throw new UnauthorizedException("invalid or expired token")
    }

    const auth = await this.loadAuthContext(payload.sub)
    if (!auth) throw new UnauthorizedException("user no longer exists")

    req.auth = auth
    return true
  }

  // Role and scope are read fresh from the DB on every request (the JWT only
  // carries the user id), so permission changes take effect immediately.
  private async loadAuthContext(userId: string): Promise<AuthContext | null> {
    const rows = await this.db
      .select({
        userId: users.id,
        userName: users.name,
        userEmail: users.email,
        membershipId: orgMemberships.id,
        role: orgMemberships.role,
        roleLabel: orgMemberships.roleLabel,
        orgId: organizations.id,
        orgName: organizations.name,
      })
      .from(users)
      .innerJoin(orgMemberships, eq(orgMemberships.userId, users.id))
      .innerJoin(organizations, eq(organizations.id, orgMemberships.orgId))
      .where(eq(users.id, userId))
      .limit(1)

    const row = rows[0]
    if (!row) return null

    let scopeTagNames: string[] | null = null
    if (row.role !== "admin") {
      const scopeRows = await this.db
        .select({ name: tags.name })
        .from(membershipScopeTags)
        .innerJoin(tags, eq(tags.id, membershipScopeTags.tagId))
        .where(eq(membershipScopeTags.membershipId, row.membershipId))
      scopeTagNames = scopeRows.map((r) => r.name)
    }

    return { ...row, scopeTagNames }
  }
}
