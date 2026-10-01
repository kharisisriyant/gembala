import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common"
import { Reflector } from "@nestjs/core"
import { JwtService } from "@nestjs/jwt"
import type { Request } from "express"
import type { AuthContext } from "./auth-context"
import { AuthContextService } from "./auth-context.service"
import { IS_PUBLIC_KEY } from "./decorators"
import { AuthService } from "../auth/auth.service"

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly authContext: AuthContextService,
    private readonly auth: AuthService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ])
    if (isPublic) return true

    const req = ctx.switchToHttp().getRequest<Request & { auth?: AuthContext; authSessionId?: string }>()
    const header = req.headers.authorization
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined
    if (!token) throw new UnauthorizedException("missing bearer token")

    let payload: { sub: string; sid: string }
    try {
      const decoded = this.jwt.decode(token, { complete: true })
      const kid = typeof decoded === "object" && decoded?.header?.kid
      if (typeof kid !== "string") throw new Error("missing key id")
      const key = this.auth.jwtVerificationKey(kid)
      if (!key) throw new Error("unknown signing key")
      payload = await this.jwt.verifyAsync<{ sub: string; sid: string }>(token, {
        secret: key,
        algorithms: ["HS256"],
        issuer: process.env.JWT_ISSUER ?? "gembala-api",
        audience: process.env.JWT_AUDIENCE ?? "gembala-web",
      })
    } catch {
      throw new UnauthorizedException("invalid or expired token")
    }

    if (!payload.sub || !payload.sid || !(await this.auth.validateAccessSession(payload.sub, payload.sid))) {
      throw new UnauthorizedException("invalid or revoked session")
    }

    const auth = await this.authContext.load(payload.sub)
    if (!auth) throw new UnauthorizedException("user no longer exists")

    req.auth = auth
    req.authSessionId = payload.sid
    return true
  }
}
