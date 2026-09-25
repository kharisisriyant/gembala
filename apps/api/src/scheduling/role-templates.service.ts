import { Injectable, NotFoundException } from "@nestjs/common"
import type {
  RoleTemplateCreateInput,
  RoleTemplateResponse,
  RoleTemplateUpdateInput,
} from "@gembala/shared"
import { roleTemplates } from "../db/schema"
import { RoleTemplatesRepository } from "./role-templates.repository"

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
  constructor(private readonly roleTemplates: RoleTemplatesRepository) {}

  async list(orgId: string): Promise<RoleTemplateResponse[]> {
    const rows = await this.roleTemplates.listByOrg(orgId)
    return rows.map(toResponse).sort((a, b) => a.sortOrder - b.sortOrder)
  }

  async detail(orgId: string, id: string): Promise<RoleTemplateResponse> {
    const row = await this.roleTemplates.findByIdInOrg(orgId, id)
    if (!row) throw new NotFoundException("role template not found")
    return toResponse(row)
  }

  async create(orgId: string, input: RoleTemplateCreateInput): Promise<RoleTemplateResponse> {
    const row = await this.roleTemplates.insert(orgId, input.name, input.sortOrder)
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

    const row = await this.roleTemplates.update(orgId, id, patch)
    return toResponse(row)
  }

  // soft-deactivate only: past events must keep rendering historical
  // assignments even after an org retires a role
  async remove(orgId: string, id: string): Promise<void> {
    await this.detail(orgId, id)
    await this.roleTemplates.update(orgId, id, { isActive: false })
  }
}
