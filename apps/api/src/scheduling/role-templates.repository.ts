import { Injectable } from "@nestjs/common"
import { and, eq } from "drizzle-orm"
import { InjectDb, type Db, type Tx } from "../db/drizzle.module"
import { roleTemplates } from "../db/schema"

export type RoleTemplatePatch = Partial<typeof roleTemplates.$inferInsert>

@Injectable()
export class RoleTemplatesRepository {
  constructor(@InjectDb() private readonly db: Db) {}

  async listByOrg(orgId: string, tx: Db | Tx = this.db) {
    return tx.select().from(roleTemplates).where(eq(roleTemplates.orgId, orgId))
  }

  async findByIdInOrg(orgId: string, id: string, tx: Db | Tx = this.db) {
    const [row] = await tx
      .select()
      .from(roleTemplates)
      .where(and(eq(roleTemplates.id, id), eq(roleTemplates.orgId, orgId)))
    return row
  }

  async insert(orgId: string, name: string, sortOrder: number, tx: Db | Tx = this.db) {
    const [row] = await tx.insert(roleTemplates).values({ orgId, name, sortOrder }).returning()
    return row
  }

  async update(orgId: string, id: string, patch: RoleTemplatePatch, tx: Db | Tx = this.db) {
    const [row] = await tx
      .update(roleTemplates)
      .set(patch)
      .where(and(eq(roleTemplates.id, id), eq(roleTemplates.orgId, orgId)))
      .returning()
    return row
  }
}
