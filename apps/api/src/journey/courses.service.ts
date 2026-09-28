import { ConflictException, Injectable, NotFoundException } from "@nestjs/common"
import type { CourseCreateInput, CourseResponse, CourseUpdateInput } from "@gembala/shared"
import type { AuthContext } from "../authz/auth-context"
import { CoursesRepository, type CourseRow } from "./courses.repository"

@Injectable()
export class CoursesService {
  constructor(private readonly courses: CoursesRepository) {}

  private toResponse(r: CourseRow): CourseResponse {
    return { id: r.id, name: r.name, kind: r.kind, enrollmentCount: r.enrollmentCount }
  }

  private async assertNameFree(orgId: string, name: string, exceptId?: string) {
    const clash = await this.courses.findByName(orgId, name)
    if (clash && clash.id !== exceptId) throw new ConflictException("a course with this name already exists")
  }

  async list(auth: AuthContext): Promise<CourseResponse[]> {
    return (await this.courses.list(auth.orgId)).map((r) => this.toResponse(r))
  }

  async create(auth: AuthContext, input: CourseCreateInput): Promise<CourseResponse> {
    await this.assertNameFree(auth.orgId, input.name)
    const { id } = await this.courses.insert({ orgId: auth.orgId, name: input.name, kind: input.kind })
    return this.toResponse((await this.courses.findById(auth.orgId, id))!)
  }

  async update(auth: AuthContext, id: string, input: CourseUpdateInput): Promise<CourseResponse> {
    if (!(await this.courses.findById(auth.orgId, id))) throw new NotFoundException("course not found")
    if (input.name) await this.assertNameFree(auth.orgId, input.name, id)
    await this.courses.update(auth.orgId, id, { name: input.name, kind: input.kind })
    return this.toResponse((await this.courses.findById(auth.orgId, id))!)
  }

  async remove(auth: AuthContext, id: string): Promise<void> {
    const course = await this.courses.findById(auth.orgId, id)
    if (!course) throw new NotFoundException("course not found")
    if (course.enrollmentCount > 0) {
      throw new ConflictException("course has enrollments and cannot be deleted")
    }
    await this.courses.delete(auth.orgId, id)
  }
}
