import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common"
import { Reflector } from "@nestjs/core"
import type { AuthContext } from "./auth-context"
import { PERMISSION_KEY, SYSTEM_ADMIN_KEY } from "./decorators"

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const auth: AuthContext | undefined = ctx.switchToHttp().getRequest().auth

    const requireSystemAdmin = this.reflector.getAllAndOverride<boolean>(SYSTEM_ADMIN_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ])
    if (requireSystemAdmin) {
      if (!auth?.isSystemAdmin) throw new ForbiddenException("admin access required")
      return true
    }

    const requiredPermission = this.reflector.getAllAndOverride<string>(PERMISSION_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ])
    if (!requiredPermission) return true

    if (!auth || (!auth.isSystemAdmin && !auth.permissions.has(requiredPermission))) {
      throw new ForbiddenException(`missing permission: ${requiredPermission}`)
    }
    return true
  }
}
