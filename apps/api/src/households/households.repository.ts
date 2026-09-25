import { Injectable } from "@nestjs/common"
import { and, eq, inArray } from "drizzle-orm"
import { InjectDb, type Db, type Tx } from "../db/drizzle.module"
import { households, members } from "../db/schema"

export type HouseholdInsert = typeof households.$inferInsert
export type HouseholdPatch = Partial<typeof households.$inferInsert>

export type HouseholdSummaryRow = {
  id: string
  name: string
  address: string
  primaryContactMemberId: string | null
}

@Injectable()
export class HouseholdsRepository {
  constructor(@InjectDb() private readonly db: Db) {}

  async listSummariesByOrg(orgId: string, tx: Db | Tx = this.db): Promise<HouseholdSummaryRow[]> {
    return tx
      .select({
        id: households.id,
        name: households.name,
        address: households.address,
        primaryContactMemberId: households.primaryContactMemberId,
      })
      .from(households)
      .where(eq(households.orgId, orgId))
  }

  async memberHouseholdIdsByOrg(orgId: string, tx: Db | Tx = this.db) {
    return tx
      .select({ id: members.id, householdId: members.householdId })
      .from(members)
      .where(eq(members.orgId, orgId))
  }

  async findByIdInOrg(orgId: string, id: string, tx: Db | Tx = this.db) {
    const [row] = await tx
      .select()
      .from(households)
      .where(and(eq(households.id, id), eq(households.orgId, orgId)))
    return row
  }

  async findMemberHouseholdId(orgId: string, memberId: string, tx: Db | Tx = this.db) {
    const [row] = await tx
      .select({ householdId: members.householdId })
      .from(members)
      .where(and(eq(members.id, memberId), eq(members.orgId, orgId)))
    return row
  }

  async insert(input: HouseholdInsert, tx: Db | Tx = this.db) {
    const [row] = await tx.insert(households).values(input).returning()
    return row
  }

  async update(id: string, patch: HouseholdPatch, tx: Db | Tx = this.db) {
    if (Object.keys(patch).length === 0) return
    await tx.update(households).set(patch).where(eq(households.id, id))
  }

  async assignMembersToHousehold(orgId: string, memberIds: string[], householdId: string, tx: Db | Tx = this.db) {
    if (memberIds.length === 0) return
    await tx
      .update(members)
      .set({ householdId })
      .where(and(eq(members.orgId, orgId), inArray(members.id, memberIds)))
  }

  async setMemberHousehold(orgId: string, memberId: string, householdId: string | null, tx: Db | Tx = this.db) {
    await tx
      .update(members)
      .set({ householdId })
      .where(and(eq(members.id, memberId), eq(members.orgId, orgId)))
  }

  async clearPrimaryContactIfMember(householdId: string, memberId: string, tx: Db | Tx = this.db) {
    await tx
      .update(households)
      .set({ primaryContactMemberId: null })
      .where(and(eq(households.id, householdId), eq(households.primaryContactMemberId, memberId)))
  }
}
