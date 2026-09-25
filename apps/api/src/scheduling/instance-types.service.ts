import { Injectable, NotFoundException } from "@nestjs/common"
import type {
  InstanceTypeCreateInput,
  InstanceTypeResponse,
  InstanceTypeUpdateInput,
} from "@gembala/shared"
import { instanceTypes } from "../db/schema"
import { InstanceTypesRepository } from "./instance-types.repository"

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
  constructor(private readonly instanceTypes: InstanceTypesRepository) {}

  async list(orgId: string): Promise<InstanceTypeResponse[]> {
    const rows = await this.instanceTypes.listByOrg(orgId)
    return rows.map(toResponse).sort((a, b) => a.sortOrder - b.sortOrder)
  }

  async detail(orgId: string, id: string): Promise<InstanceTypeResponse> {
    const row = await this.instanceTypes.findByIdInOrg(orgId, id)
    if (!row) throw new NotFoundException("instance type not found")
    return toResponse(row)
  }

  async create(orgId: string, input: InstanceTypeCreateInput): Promise<InstanceTypeResponse> {
    const row = await this.instanceTypes.insert(orgId, input.name, input.sortOrder)
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

    const row = await this.instanceTypes.update(orgId, id, patch)
    return toResponse(row)
  }

  // soft-deactivate only: past events must keep rendering historical
  // assignments even after an org retires an instance type
  async remove(orgId: string, id: string): Promise<void> {
    await this.detail(orgId, id)
    await this.instanceTypes.update(orgId, id, { isActive: false })
  }
}
