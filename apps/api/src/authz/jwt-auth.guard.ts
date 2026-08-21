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

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly authContext: AuthContextService,
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

    const auth = await this.authContext.load(payload.sub)
    if (!auth) throw new UnauthorizedException("user no longer exists")

    req.auth = auth
    return true
  }
}
