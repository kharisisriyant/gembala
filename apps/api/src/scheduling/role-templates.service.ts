import { Injectable, NotFoundException } from "@nestjs/common"
import type {
  RoleTemplateCreateInput,
  RoleTemplateResponse,
  RoleTemplateUpdateInput,
} from "@gembala/shared"
import { and, eq } from "drizzle-orm"
import { InjectDb, type Db } from "../db/drizzle.module"
import { roleTemplates } from "../db/schema"

function toResponse(row: typeof roleTemplates.$inferSelect): RoleTemplateResponse {
  return {
    id: row.id,
    name: row.name,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
  }
}

@Injectable()
export class RoleTemplatesService {
  constructor(@InjectDb() private readonly db: Db) {}

  async list(orgId: string): Promise<RoleTemplateResponse[]> {
    const rows = await this.db.select().from(roleTemplates).where(eq(roleTemplates.orgId, orgId))
    return rows.map(toResponse).sort((a, b) => a.sortOrder - b.sortOrder)
  }

  async detail(orgId: string, id: string): Promise<RoleTemplateResponse> {
    const [row] = await this.db
      .select()
      .from(roleTemplates)
      .where(and(eq(roleTemplates.id, id), eq(roleTemplates.orgId, orgId)))
    if (!row) throw new NotFoundException("role template not found")
    return toResponse(row)
  }

  async create(orgId: string, input: RoleTemplateCreateInput): Promise<RoleTemplateResponse> {
    const [row] = await this.db
      .insert(roleTemplates)
      .values({ orgId, name: input.name, sortOrder: input.sortOrder })
      .returning()
    return toResponse(row)
  }

  async update(
    orgId: string,
    id: string,
    input: RoleTemplateUpdateInput,
  ): Promise<RoleTemplateResponse> {
    await this.detail(orgId, id)

    const patch: Partial<typeof roleTemplates.$inferInsert> = {}
    if (input.name !== undefined) patch.name = input.name
    if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder
    if (input.isActive !== undefined) patch.isActive = input.isActive

    const [row] = await this.db
      .update(roleTemplates)
      .set(patch)
      .where(and(eq(roleTemplates.id, id), eq(roleTemplates.orgId, orgId)))
      .returning()
    return toResponse(row)
  }

  // soft-deactivate only: past events must keep rendering historical
  // assignments even after an org retires a role
  async remove(orgId: string, id: string): Promise<void> {
    await this.detail(orgId, id)
    await this.db
      .update(roleTemplates)
      .set({ isActive: false })
      .where(and(eq(roleTemplates.id, id), eq(roleTemplates.orgId, orgId)))
  }
}
