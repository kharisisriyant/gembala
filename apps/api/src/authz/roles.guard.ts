import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common"
import { Reflector } from "@nestjs/core"
import type { MembershipRole } from "@gembala/shared"
import type { AuthContext } from "./auth-context"
import { ROLES_KEY } from "./decorators"

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<MembershipRole[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ])
    if (!required || required.length === 0) return true

    const auth: AuthContext | undefined = ctx.switchToHttp().getRequest().auth
    if (!auth || !required.includes(auth.role)) {
      throw new ForbiddenException("admin access required")
    }
    return true
  }
}
