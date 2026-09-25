import { Injectable } from "@nestjs/common"
import { and, eq, or } from "drizzle-orm"
import { InjectDb, type Db, type Tx } from "../db/drizzle.module"
import { memberRelationships } from "../db/schema"

export type MemberRelationType = (typeof memberRelationships.$inferSelect)["relationType"]

@Injectable()
export class MemberRelationshipsRepository {
  constructor(@InjectDb() private readonly db: Db) {}

  async findAllInvolving(memberId: string, tx: Db | Tx = this.db) {
    return tx
      .select()
      .from(memberRelationships)
      .where(or(eq(memberRelationships.memberId, memberId), eq(memberRelationships.relatedMemberId, memberId)))
  }

  async findCanonical(
    memberId: string,
    relatedMemberId: string,
    relationType: MemberRelationType,
    tx: Db | Tx = this.db,
  ) {
    const [row] = await tx
      .select()
      .from(memberRelationships)
      .where(
        and(
          eq(memberRelationships.memberId, memberId),
          eq(memberRelationships.relatedMemberId, relatedMemberId),
          eq(memberRelationships.relationType, relationType),
        ),
      )
    return row
  }

  async insert(
    input: { memberId: string; relatedMemberId: string; relationType: MemberRelationType },
    tx: Db | Tx = this.db,
  ) {
    await tx.insert(memberRelationships).values(input)
  }

  async deleteCanonical(
    memberId: string,
    relatedMemberId: string,
    relationType: MemberRelationType,
    tx: Db | Tx = this.db,
  ) {
    const result = await tx
      .delete(memberRelationships)
      .where(
        and(
          eq(memberRelationships.memberId, memberId),
          eq(memberRelationships.relatedMemberId, relatedMemberId),
          eq(memberRelationships.relationType, relationType),
        ),
      )
      .returning()
    return result.length > 0
  }
}
