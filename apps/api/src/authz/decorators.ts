import {
  applyDecorators,
  createParamDecorator,
  SetMetadata,
  type ExecutionContext,
} from "@nestjs/common"
import { ApiExtension } from "@nestjs/swagger"
import { permissionKey, type PermissionAction, type PermissionResource } from "@gembala/shared"
import type { AuthContext } from "./auth-context"
import { X_PERMISSION, X_PUBLIC, X_SYSTEM_ADMIN } from "../swagger/extensions"

export const IS_PUBLIC_KEY = "isPublic"
export const Public = () =>
  applyDecorators(SetMetadata(IS_PUBLIC_KEY, true), ApiExtension(X_PUBLIC, true))

export const PERMISSION_KEY = "permission"
export const RequirePermission = (resource: PermissionResource, action: PermissionAction) =>
  applyDecorators(
    SetMetadata(PERMISSION_KEY, permissionKey(resource, action)),
    ApiExtension(X_PERMISSION, permissionKey(resource, action)),
  )

export const SYSTEM_ADMIN_KEY = "systemAdmin"
export const RequireSystemAdmin = () =>
  applyDecorators(SetMetadata(SYSTEM_ADMIN_KEY, true), ApiExtension(X_SYSTEM_ADMIN, true))

export const CurrentAuth = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthContext => {
    return ctx.switchToHttp().getRequest().auth
  },
)
