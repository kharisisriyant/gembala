import { ForbiddenException, Injectable } from "@nestjs/common"
import { expandWithDescendants, type TagDef } from "@gembala/shared"
import { eq } from "drizzle-orm"
import { InjectDb, type Db } from "../db/drizzle.module"
import { tags } from "../db/schema"
import type { AuthContext } from "./auth-context"

export type TagRow = {
  id: string
  name: string
  parentId: string | null
  description: string | null
}

// Server-side twin of the prototype's viewer.tsx visibility rules. Tag counts
// per org are tiny, so we load them once per request and reuse the exact
// shared tag-tree helpers the UI uses (identical subtree semantics).
@Injectable()
export class ScopeService {
  constructor(@InjectDb() private readonly db: Db) {}

  async orgTags(orgId: string): Promise<TagRow[]> {
    return this.db
      .select({
        id: tags.id,
        name: tags.name,
        parentId: tags.parentId,
        description: tags.description,
      })
      .from(tags)
      .where(eq(tags.orgId, orgId))
  }

  toTagDefs(rows: TagRow[]): TagDef[] {
    const nameById = new Map(rows.map((r) => [r.id, r.name]))
    return rows.map((r) => ({
      name: r.name,
      parent: r.parentId ? (nameById.get(r.parentId) ?? null) : null,
      description: r.description ?? undefined,
    }))
  }

  // null = full access (admin).
  async expandedScope(auth: AuthContext, tagRows?: TagRow[]): Promise<Set<string> | null> {
    if (auth.scopeTagNames === null) return null
    const rows = tagRows ?? (await this.orgTags(auth.orgId))
    return expandWithDescendants(this.toTagDefs(rows), auth.scopeTagNames)
  }

  // A member is visible when any of its tags is inside the expanded scope.
  memberVisible(scope: Set<string> | null, memberTagNames: string[]): boolean {
    if (scope === null) return true
    return memberTagNames.some((t) => scope.has(t))
  }

  groupVisible(scope: Set<string> | null, scopeTagName: string): boolean {
    if (scope === null) return true
    return scope.has(scopeTagName)
  }

  assertGroupVisible(scope: Set<string> | null, scopeTagName: string): void {
    if (!this.groupVisible(scope, scopeTagName)) {
      throw new ForbiddenException("this group is outside your scope")
    }
  }

  // Leaders may only write members that stay visible to them.
  assertCanWriteMemberTags(scope: Set<string> | null, memberTagNames: string[]): void {
    if (!this.memberVisible(scope, memberTagNames)) {
      throw new ForbiddenException("member tags must include at least one tag in your scope")
    }
  }
}
