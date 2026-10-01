import { ConflictException, Injectable, NotFoundException } from "@nestjs/common"
import type { JourneyStageCreateInput, JourneyStageResponse, JourneyStageUpdateInput } from "@gembala/shared"
import type { AuthContext } from "../authz/auth-context"
import { JourneyStagesRepository } from "./journey-stages.repository"

@Injectable()
export class JourneyStagesService {
  constructor(private readonly repo: JourneyStagesRepository) {}

  private response(row: Awaited<ReturnType<JourneyStagesRepository["find"]>> & {}) : JourneyStageResponse {
    return { id: row.id, name: row.name, description: row.description, rule: row.rule, reminderDays: row.reminderDays, courseKind: row.courseKind, sortOrder: row.sortOrder, active: row.active }
  }

  async list(auth: AuthContext): Promise<JourneyStageResponse[]> { return (await this.repo.list(auth.orgId)).map((row) => this.response(row)) }

  async create(auth: AuthContext, input: JourneyStageCreateInput): Promise<JourneyStageResponse> {
    try { return this.response(await this.repo.insert({ orgId: auth.orgId, ...input, description: input.description || null, courseKind: input.courseKind ?? null })) }
    catch { throw new ConflictException("a stage with this name already exists") }
  }

  async update(auth: AuthContext, id: string, input: JourneyStageUpdateInput): Promise<JourneyStageResponse> {
    const stage = await this.repo.find(auth.orgId, id)
    if (!stage) throw new NotFoundException("journey stage not found")
    const next = { ...stage, ...input }
    if (next.rule === "course_completed" && !next.courseKind) throw new ConflictException("course kind is required for this rule")
    try { return this.response((await this.repo.update(auth.orgId, id, { ...input, description: input.description === undefined ? undefined : input.description || null, courseKind: input.courseKind === undefined ? undefined : input.courseKind ?? null }))!) }
    catch { throw new ConflictException("a stage with this name already exists") }
  }

  async remove(auth: AuthContext, id: string): Promise<void> {
    if (!(await this.repo.find(auth.orgId, id))) throw new NotFoundException("journey stage not found")
    await this.repo.delete(auth.orgId, id)
  }
}
