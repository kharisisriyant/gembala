import {
  createParamDecorator,
  SetMetadata,
  type ExecutionContext,
} from "@nestjs/common"
import type { MembershipRole } from "@gembala/shared"
import type { AuthContext } from "./auth-context"

export const IS_PUBLIC_KEY = "isPublic"
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true)

export const ROLES_KEY = "roles"
export const Roles = (...roles: MembershipRole[]) => SetMetadata(ROLES_KEY, roles)

export const CurrentAuth = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthContext => {
    return ctx.switchToHttp().getRequest().auth
  },
)
