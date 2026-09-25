import { Injectable } from "@nestjs/common"
import { and, eq } from "drizzle-orm"
import { InjectDb, type Db, type Tx } from "../db/drizzle.module"
import { instanceTypes } from "../db/schema"

export type InstanceTypePatch = Partial<typeof instanceTypes.$inferInsert>

@Injectable()
export class InstanceTypesRepository {
  constructor(@InjectDb() private readonly db: Db) {}

  async listByOrg(orgId: string, tx: Db | Tx = this.db) {
    return tx.select().from(instanceTypes).where(eq(instanceTypes.orgId, orgId))
  }

  async findByIdInOrg(orgId: string, id: string, tx: Db | Tx = this.db) {
    const [row] = await tx
      .select()
      .from(instanceTypes)
      .where(and(eq(instanceTypes.id, id), eq(instanceTypes.orgId, orgId)))
    return row
  }

  async insert(orgId: string, name: string, sortOrder: number, tx: Db | Tx = this.db) {
    const [row] = await tx.insert(instanceTypes).values({ orgId, name, sortOrder }).returning()
    return row
  }

  async update(orgId: string, id: string, patch: InstanceTypePatch, tx: Db | Tx = this.db) {
    const [row] = await tx
      .update(instanceTypes)
      .set(patch)
      .where(and(eq(instanceTypes.id, id), eq(instanceTypes.orgId, orgId)))
      .returning()
    return row
  }
}
