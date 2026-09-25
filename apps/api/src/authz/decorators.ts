import {
  createParamDecorator,
  SetMetadata,
  type ExecutionContext,
} from "@nestjs/common"
import { permissionKey, type PermissionAction, type PermissionResource } from "@gembala/shared"
import type { AuthContext } from "./auth-context"

export const IS_PUBLIC_KEY = "isPublic"
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true)

export const PERMISSION_KEY = "permission"
export const RequirePermission = (resource: PermissionResource, action: PermissionAction) =>
  SetMetadata(PERMISSION_KEY, permissionKey(resource, action))

export const SYSTEM_ADMIN_KEY = "systemAdmin"
export const RequireSystemAdmin = () => SetMetadata(SYSTEM_ADMIN_KEY, true)

export const CurrentAuth = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthContext => {
    return ctx.switchToHttp().getRequest().auth
  },
)
