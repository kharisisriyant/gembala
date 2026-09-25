import { Injectable, NotFoundException } from "@nestjs/common"
import type {
  InstanceTypeCreateInput,
  InstanceTypeResponse,
  InstanceTypeUpdateInput,
} from "@gembala/shared"
import { and, eq } from "drizzle-orm"
import { InjectDb, type Db } from "../db/drizzle.module"
import { instanceTypes } from "../db/schema"

function toResponse(row: typeof instanceTypes.$inferSelect): InstanceTypeResponse {
  return {
    id: row.id,
    name: row.name,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
  }
}

@Injectable()
export class InstanceTypesService {
  constructor(@InjectDb() private readonly db: Db) {}

  async list(orgId: string): Promise<InstanceTypeResponse[]> {
    const rows = await this.db.select().from(instanceTypes).where(eq(instanceTypes.orgId, orgId))
    return rows.map(toResponse).sort((a, b) => a.sortOrder - b.sortOrder)
  }

  async detail(orgId: string, id: string): Promise<InstanceTypeResponse> {
    const [row] = await this.db
      .select()
      .from(instanceTypes)
      .where(and(eq(instanceTypes.id, id), eq(instanceTypes.orgId, orgId)))
    if (!row) throw new NotFoundException("instance type not found")
    return toResponse(row)
  }

  async create(orgId: string, input: InstanceTypeCreateInput): Promise<InstanceTypeResponse> {
    const [row] = await this.db
      .insert(instanceTypes)
      .values({ orgId, name: input.name, sortOrder: input.sortOrder })
      .returning()
    return toResponse(row)
  }

  async update(
    orgId: string,
    id: string,
    input: InstanceTypeUpdateInput,
  ): Promise<InstanceTypeResponse> {
    await this.detail(orgId, id)

    const patch: Partial<typeof instanceTypes.$inferInsert> = {}
    if (input.name !== undefined) patch.name = input.name
    if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder
    if (input.isActive !== undefined) patch.isActive = input.isActive

    const [row] = await this.db
      .update(instanceTypes)
      .set(patch)
      .where(and(eq(instanceTypes.id, id), eq(instanceTypes.orgId, orgId)))
      .returning()
    return toResponse(row)
  }

  // soft-deactivate only: past events must keep rendering historical
  // assignments even after an org retires an instance type
  async remove(orgId: string, id: string): Promise<void> {
    await this.detail(orgId, id)
    await this.db
      .update(instanceTypes)
      .set({ isActive: false })
      .where(and(eq(instanceTypes.id, id), eq(instanceTypes.orgId, orgId)))
  }
}
