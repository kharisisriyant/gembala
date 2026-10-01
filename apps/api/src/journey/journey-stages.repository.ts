import { Injectable } from "@nestjs/common"
import { and, asc, eq } from "drizzle-orm"
import { InjectDb, type Db, type Tx } from "../db/drizzle.module"
import { journeyStageAssignments, journeyStages } from "../db/schema"

export type StageInsert = typeof journeyStages.$inferInsert
export type StagePatch = Partial<Omit<StageInsert, "id" | "orgId" | "createdAt">>

@Injectable()
export class JourneyStagesRepository {
  constructor(@InjectDb() private readonly db: Db) {}

  list(orgId: string, tx: Db | Tx = this.db) {
    return tx.select().from(journeyStages).where(eq(journeyStages.orgId, orgId)).orderBy(asc(journeyStages.sortOrder), asc(journeyStages.name))
  }

  async find(orgId: string, id: string, tx: Db | Tx = this.db) {
    const [row] = await tx.select().from(journeyStages).where(and(eq(journeyStages.orgId, orgId), eq(journeyStages.id, id)))
    return row
  }

  async insert(input: StageInsert, tx: Db | Tx = this.db) {
    const [row] = await tx.insert(journeyStages).values(input).returning()
    return row
  }

  async update(orgId: string, id: string, patch: StagePatch, tx: Db | Tx = this.db) {
    const [row] = await tx.update(journeyStages).set(patch).where(and(eq(journeyStages.orgId, orgId), eq(journeyStages.id, id))).returning()
    return row
  }

  async delete(orgId: string, id: string, tx: Db | Tx = this.db) {
    await tx.delete(journeyStages).where(and(eq(journeyStages.orgId, orgId), eq(journeyStages.id, id)))
  }

  async assignment(stageId: string, memberId: string, tx: Db | Tx = this.db) {
    const [row] = await tx.select({ id: journeyStageAssignments.id }).from(journeyStageAssignments).where(and(eq(journeyStageAssignments.stageId, stageId), eq(journeyStageAssignments.memberId, memberId)))
    return row
  }

  async addAssignment(input: typeof journeyStageAssignments.$inferInsert, tx: Db | Tx = this.db) {
    const [row] = await tx.insert(journeyStageAssignments).values(input).returning({ id: journeyStageAssignments.id })
    return row
  }

  async removeAssignment(orgId: string, stageId: string, memberId: string, tx: Db | Tx = this.db) {
    await tx.delete(journeyStageAssignments).where(and(eq(journeyStageAssignments.orgId, orgId), eq(journeyStageAssignments.stageId, stageId), eq(journeyStageAssignments.memberId, memberId)))
  }

  assignments(orgId: string, tx: Db | Tx = this.db) {
    return tx.select({ stageId: journeyStageAssignments.stageId, memberId: journeyStageAssignments.memberId, createdAt: journeyStageAssignments.createdAt }).from(journeyStageAssignments).where(eq(journeyStageAssignments.orgId, orgId))
  }
}
