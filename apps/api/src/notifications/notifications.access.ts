import { Inject, Injectable } from "@nestjs/common"
import { AuthContextService } from "../authz/auth-context.service"
import { ScopeService } from "../authz/scope.service"
import { NOTIFICATION_CATALOG, catalogByKey, type AccessChecks, type NotificationType } from "./notifications.catalog"
import { NotificationsRepository } from "./notifications.repository"

// Subject access (RT-2): reuses the permission and tag-scope rules the rest of
// the API enforces, so notifications never reveal what the user couldn't open.
@Injectable()
export class NotificationAccess implements AccessChecks {
  private readonly catalog: Map<string, NotificationType>

  constructor(
    private readonly authContext: AuthContextService,
    private readonly scope: ScopeService,
    private readonly repo: NotificationsRepository,
    @Inject(NOTIFICATION_CATALOG) types: NotificationType[],
  ) {
    this.catalog = catalogByKey(types)
  }

  async memberVisible(userId: string, orgId: string, memberId: string): Promise<boolean> {
    const auth = await this.authContext.load(userId)
    if (!auth || auth.orgId !== orgId) return false
    const tags = await this.repo.memberTagNames(orgId, memberId)
    if (tags === null) return false
    return this.scope.memberVisible(await this.scope.expandedScope(auth), tags)
  }

  // True when the type has no extra rule, or the rule passes.
  async allowed(typeKey: string, userId: string, orgId: string, payload: unknown): Promise<boolean> {
    const type = this.catalog.get(typeKey)
    if (!type?.canAccess) return true
    return type.canAccess({ userId, orgId, payload }, this)
  }
}
