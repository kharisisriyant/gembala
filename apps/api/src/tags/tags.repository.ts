import { Injectable } from "@nestjs/common"
import { and, eq, inArray } from "drizzle-orm"
import { InjectDb, type Db, type Tx } from "../db/drizzle.module"
import { groups, members, memberTags, tags } from "../db/schema"

export type TagPatch = Partial<{ parentId: string | null; description: string | null }>

@Injectable()
export class TagsRepository {
  constructor(@InjectDb() private readonly db: Db) {}

  async findIdsByNames(orgId: string, names: string[], tx: Db | Tx = this.db) {
    return tx
      .select({ id: tags.id, name: tags.name })
      .from(tags)
      .where(and(eq(tags.orgId, orgId), inArray(tags.name, names)))
  }

  async memberTagsByOrg(orgId: string, tx: Db | Tx = this.db) {
    return tx
      .select({ memberId: memberTags.memberId, name: tags.name })
      .from(memberTags)
      .innerJoin(tags, eq(tags.id, memberTags.tagId))
      .innerJoin(members, eq(members.id, memberTags.memberId))
      .where(eq(members.orgId, orgId))
  }

  async findByOrgAndName(orgId: string, name: string, tx: Db | Tx = this.db) {
    const [row] = await tx
      .select({ id: tags.id })
      .from(tags)
      .where(and(eq(tags.orgId, orgId), eq(tags.name, name)))
    return row
  }

  async insert(
    input: { orgId: string; name: string; parentId: string | null; description: string | null },
    tx: Db | Tx = this.db,
  ) {
    await tx.insert(tags).values(input)
  }

  async update(id: string, patch: TagPatch, tx: Db | Tx = this.db) {
    if (Object.keys(patch).length === 0) return
    await tx.update(tags).set(patch).where(eq(tags.id, id))
  }

  async findGroupScopedToTag(tagId: string, tx: Db | Tx = this.db) {
    const [row] = await tx
      .select({ id: groups.id, name: groups.name })
      .from(groups)
      .where(eq(groups.scopeTagId, tagId))
      .limit(1)
    return row
  }

  // Reparents children one level up, then deletes the tag — matches the
  // prototype's removeTag semantics. Always runs as one transaction.
  async reparentChildrenAndDelete(tagId: string, newParentId: string | null, tx: Db | Tx = this.db) {
    await tx.update(tags).set({ parentId: newParentId }).where(eq(tags.parentId, tagId))
    await tx.delete(tags).where(eq(tags.id, tagId))
  }
}
