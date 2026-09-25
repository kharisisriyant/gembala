import { Injectable } from "@nestjs/common"
import { and, eq } from "drizzle-orm"
import { InjectDb, type Db, type Tx } from "../db/drizzle.module"
import { groupMembers, groups, members, memberTags, tags } from "../db/schema"

export type MemberInsert = typeof members.$inferInsert
export type MemberPatch = Partial<typeof members.$inferInsert>

@Injectable()
export class MembersRepository {
  constructor(@InjectDb() private readonly db: Db) {}

  async listByOrg(orgId: string, tx: Db | Tx = this.db) {
    return tx.select().from(members).where(eq(members.orgId, orgId))
  }

  async tagsByOrg(orgId: string, tx: Db | Tx = this.db) {
    return tx
      .select({ memberId: memberTags.memberId, name: tags.name })
      .from(memberTags)
      .innerJoin(tags, eq(tags.id, memberTags.tagId))
      .innerJoin(members, eq(members.id, memberTags.memberId))
      .where(eq(members.orgId, orgId))
  }

  async groupsByMemberId(memberId: string, tx: Db | Tx = this.db) {
    return tx
      .select({ id: groups.id, name: groups.name })
      .from(groupMembers)
      .innerJoin(groups, eq(groups.id, groupMembers.groupId))
      .where(eq(groupMembers.memberId, memberId))
  }

  async insert(input: MemberInsert, tx: Db | Tx = this.db) {
    const [row] = await tx.insert(members).values(input).returning()
    return row
  }

  async insertTags(memberId: string, tagIds: string[], tx: Db | Tx = this.db) {
    if (tagIds.length === 0) return
    await tx.insert(memberTags).values(tagIds.map((tagId) => ({ memberId, tagId })))
  }

  async update(orgId: string, id: string, patch: MemberPatch, tx: Db | Tx = this.db) {
    if (Object.keys(patch).length === 0) return
    await tx.update(members).set(patch).where(and(eq(members.id, id), eq(members.orgId, orgId)))
  }

  async replaceTags(memberId: string, tagIds: string[], tx: Db | Tx = this.db) {
    await tx.delete(memberTags).where(eq(memberTags.memberId, memberId))
    await this.insertTags(memberId, tagIds, tx)
  }
}
