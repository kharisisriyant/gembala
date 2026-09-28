import { Injectable } from "@nestjs/common"
import { and, desc, eq, inArray } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"
import { InjectDb, type Db, type Tx } from "../db/drizzle.module"
import { careRequests, members, memberTags, tags, users } from "../db/schema"

export type CareRequestInsert = typeof careRequests.$inferInsert
export type CareRequestPatch = Partial<typeof careRequests.$inferInsert>
export type CareRequestFilters = {
  status?: "open" | "closed"
  type?: "prayer" | "care"
  memberId?: string
}

const submitter = alias(users, "submitter")
const closer = alias(users, "closer")

const rowShape = {
  id: careRequests.id,
  memberId: careRequests.memberId,
  memberName: members.name,
  type: careRequests.type,
  body: careRequests.body,
  status: careRequests.status,
  source: careRequests.source,
  submittedById: careRequests.submittedByUserId,
  submittedByName: submitter.name,
  closedAt: careRequests.closedAt,
  closedById: careRequests.closedByUserId,
  closedByName: closer.name,
  closeNote: careRequests.closeNote,
  createdAt: careRequests.createdAt,
  updatedAt: careRequests.updatedAt,
}

export type CareRequestRow = {
  id: string
  memberId: string
  memberName: string
  type: "prayer" | "care"
  body: string
  status: "open" | "closed"
  source: "leader" | "member"
  submittedById: string | null
  submittedByName: string | null
  closedAt: Date | null
  closedById: string | null
  closedByName: string | null
  closeNote: string | null
  createdAt: Date
  updatedAt: Date
}

@Injectable()
export class CareRequestsRepository {
  constructor(@InjectDb() private readonly db: Db) {}

  private baseSelect(tx: Db | Tx) {
    return tx
      .select(rowShape)
      .from(careRequests)
      .innerJoin(members, eq(members.id, careRequests.memberId))
      .leftJoin(submitter, eq(submitter.id, careRequests.submittedByUserId))
      .leftJoin(closer, eq(closer.id, careRequests.closedByUserId))
  }

  async list(orgId: string, filters: CareRequestFilters, tx: Db | Tx = this.db): Promise<CareRequestRow[]> {
    const conds = [eq(careRequests.orgId, orgId)]
    if (filters.status) conds.push(eq(careRequests.status, filters.status))
    if (filters.type) conds.push(eq(careRequests.type, filters.type))
    if (filters.memberId) conds.push(eq(careRequests.memberId, filters.memberId))
    return this.baseSelect(tx).where(and(...conds)).orderBy(desc(careRequests.createdAt))
  }

  async findById(orgId: string, id: string, tx: Db | Tx = this.db): Promise<CareRequestRow | undefined> {
    const [row] = await this.baseSelect(tx)
      .where(and(eq(careRequests.orgId, orgId), eq(careRequests.id, id)))
    return row
  }

  async findMember(
    orgId: string,
    memberId: string,
    tx: Db | Tx = this.db,
  ): Promise<{ id: string; name: string } | undefined> {
    const [row] = await tx
      .select({ id: members.id, name: members.name })
      .from(members)
      .where(and(eq(members.orgId, orgId), eq(members.id, memberId)))
    return row
  }

  async tagNamesByMemberIds(memberIds: string[], tx: Db | Tx = this.db) {
    if (memberIds.length === 0) return []
    return tx
      .select({ memberId: memberTags.memberId, name: tags.name })
      .from(memberTags)
      .innerJoin(tags, eq(tags.id, memberTags.tagId))
      .where(inArray(memberTags.memberId, memberIds))
  }

  async insert(input: CareRequestInsert, tx: Db | Tx = this.db) {
    const [row] = await tx.insert(careRequests).values(input).returning({ id: careRequests.id })
    return row
  }

  async update(orgId: string, id: string, patch: CareRequestPatch, tx: Db | Tx = this.db) {
    await tx
      .update(careRequests)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(careRequests.orgId, orgId), eq(careRequests.id, id)))
  }

  async delete(orgId: string, id: string, tx: Db | Tx = this.db) {
    await tx.delete(careRequests).where(and(eq(careRequests.orgId, orgId), eq(careRequests.id, id)))
  }
}
