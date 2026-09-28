import { ConflictException, Injectable, NotFoundException } from "@nestjs/common"
import type {
  EnrollmentCreateInput,
  EnrollmentResponse,
  EnrollmentUpdateInput,
  LeadershipAssessmentCreateInput,
  LeadershipAssessmentResponse,
  MemberJourneyResponse,
  MilestoneCreateInput,
  MilestoneResponse,
  PipelineQuery,
  PipelineRowResponse,
} from "@gembala/shared"
import { InjectDb, type Db } from "../db/drizzle.module"
import { ScopeService } from "../authz/scope.service"
import type { AuthContext } from "../authz/auth-context"
import { MembersRepository } from "../members/members.repository"
import { CoursesRepository } from "./courses.repository"
import {
  JourneyRepository,
  type AssessmentRow,
  type EnrollmentRow,
  type JourneyMember,
  type MilestoneRow,
} from "./journey.repository"
import { computePipeline } from "./pipeline"

const todayIso = () => new Date().toISOString().slice(0, 10)

@Injectable()
export class JourneyService {
  constructor(
    @InjectDb() private readonly db: Db,
    private readonly journey: JourneyRepository,
    private readonly courses: CoursesRepository,
    private readonly members: MembersRepository,
    private readonly scope: ScopeService,
  ) {}

  private userRef(id: string | null, name: string | null) {
    return id && name ? { id, name } : null
  }

  private milestoneResponse(r: MilestoneRow): MilestoneResponse {
    return {
      id: r.id,
      memberId: r.memberId,
      type: r.type,
      achievedAt: r.achievedAt,
      note: r.note,
      recordedBy: this.userRef(r.recordedById, r.recordedByName),
      createdAt: r.createdAt.toISOString(),
    }
  }

  private enrollmentResponse(r: EnrollmentRow): EnrollmentResponse {
    return {
      id: r.id,
      memberId: r.memberId,
      course: { id: r.courseId, name: r.courseName, kind: r.courseKind },
      status: r.status,
      startedAt: r.startedAt,
      completedAt: r.completedAt,
    }
  }

  private assessmentResponse(r: AssessmentRow): LeadershipAssessmentResponse {
    return {
      id: r.id,
      memberId: r.memberId,
      level: r.level,
      targetRole: r.targetRole,
      note: r.note,
      assessedBy: this.userRef(r.assessedById, r.assessedByName),
      assessedAt: r.assessedAt.toISOString(),
    }
  }

  // Journey data is visible iff its member is. Missing and out-of-scope both
  // read as 404 so existence isn't leaked.
  private async visibleMember(auth: AuthContext, memberId: string, notFound = "member not found"): Promise<JourneyMember> {
    const member = await this.journey.findMember(auth.orgId, memberId)
    if (!member) throw new NotFoundException(notFound)
    const scope = await this.scope.expandedScope(auth)
    const tagRows = await this.journey.tagNamesByMemberIds([member.id])
    if (!this.scope.memberVisible(scope, tagRows.map((t) => t.name))) throw new NotFoundException(notFound)
    return member
  }

  async getJourney(auth: AuthContext, memberId: string): Promise<MemberJourneyResponse> {
    await this.visibleMember(auth, memberId)
    const [milestones, enrollments, assessments] = await Promise.all([
      this.journey.listMilestones(auth.orgId, memberId),
      this.journey.listEnrollments(auth.orgId, memberId),
      this.journey.listAssessments(auth.orgId, memberId),
    ])
    return {
      milestones: milestones.map((r) => this.milestoneResponse(r)),
      enrollments: enrollments.map((r) => this.enrollmentResponse(r)),
      assessments: assessments.map((r) => this.assessmentResponse(r)),
    }
  }

  // ---- milestones ----------------------------------------------------------

  async addMilestone(auth: AuthContext, memberId: string, input: MilestoneCreateInput): Promise<MilestoneResponse> {
    await this.visibleMember(auth, memberId)
    const { id } = await this.db.transaction(async (tx) => {
      const created = await this.journey.insertMilestone(
        {
          orgId: auth.orgId,
          memberId,
          type: input.type,
          achievedAt: input.achievedAt,
          note: input.note || null,
          recordedByUserId: auth.userId,
        },
        tx,
      )
      // members.baptismStatus/baptismDate stay the single source for the
      // "baptized" filter; a baptism milestone keeps them in step.
      if (input.type === "baptism") {
        await this.members.update(
          auth.orgId,
          memberId,
          { baptismStatus: "baptized", baptismDate: input.achievedAt },
          tx,
        )
      }
      return created
    })
    return this.milestoneResponse((await this.journey.findMilestoneById(auth.orgId, id))!)
  }

  async removeMilestone(auth: AuthContext, id: string): Promise<void> {
    const milestone = await this.journey.findMilestoneById(auth.orgId, id)
    if (!milestone) throw new NotFoundException("milestone not found")
    await this.visibleMember(auth, milestone.memberId, "milestone not found")
    await this.db.transaction(async (tx) => {
      await this.journey.deleteMilestone(auth.orgId, id, tx)
      if (milestone.type !== "baptism") return
      const remaining = await this.journey.latestBaptismDate(milestone.memberId, tx)
      await this.members.update(
        auth.orgId,
        milestone.memberId,
        remaining
          ? { baptismStatus: "baptized", baptismDate: remaining }
          : { baptismStatus: "not_baptized", baptismDate: null },
        tx,
      )
    })
  }

  // ---- enrollments ---------------------------------------------------------

  async addEnrollment(auth: AuthContext, memberId: string, input: EnrollmentCreateInput): Promise<EnrollmentResponse> {
    await this.visibleMember(auth, memberId)
    const course = await this.courses.findById(auth.orgId, input.courseId)
    if (!course) throw new NotFoundException("course not found")
    if (await this.journey.findEnrollment(memberId, course.id)) {
      throw new ConflictException("member is already enrolled in this course")
    }
    const startedAt = input.startedAt ?? todayIso()
    const { id } = await this.db.transaction(async (tx) => {
      const created = await this.journey.insertEnrollment(
        { orgId: auth.orgId, memberId, courseId: course.id, startedAt },
        tx,
      )
      await this.journey.insertMilestone(
        {
          orgId: auth.orgId,
          memberId,
          type: "joined_class",
          achievedAt: startedAt,
          note: course.name,
          recordedByUserId: auth.userId,
        },
        tx,
      )
      return created
    })
    return this.enrollmentResponse((await this.journey.findEnrollmentById(auth.orgId, id))!)
  }

  async updateEnrollment(auth: AuthContext, id: string, input: EnrollmentUpdateInput): Promise<EnrollmentResponse> {
    const enrollment = await this.journey.findEnrollmentById(auth.orgId, id)
    if (!enrollment) throw new NotFoundException("enrollment not found")
    await this.visibleMember(auth, enrollment.memberId, "enrollment not found")
    await this.journey.updateEnrollment(auth.orgId, id, {
      status: input.status,
      completedAt: input.status === "completed" ? (enrollment.completedAt ?? todayIso()) : null,
    })
    return this.enrollmentResponse((await this.journey.findEnrollmentById(auth.orgId, id))!)
  }

  // ---- leadership ----------------------------------------------------------

  async addAssessment(
    auth: AuthContext,
    memberId: string,
    input: LeadershipAssessmentCreateInput,
  ): Promise<LeadershipAssessmentResponse> {
    await this.visibleMember(auth, memberId)
    const { id } = await this.journey.insertAssessment({
      orgId: auth.orgId,
      memberId,
      level: input.level,
      targetRole: input.targetRole,
      note: input.note || null,
      assessedByUserId: auth.userId,
    })
    return this.assessmentResponse((await this.journey.findAssessmentById(auth.orgId, id))!)
  }

  // ---- pipeline ------------------------------------------------------------

  async pipeline(auth: AuthContext, query: PipelineQuery): Promise<PipelineRowResponse[]> {
    const [allMembers, tagRows, enrollments, milestones, grouped, assessments, scope] = await Promise.all([
      this.journey.orgMembers(auth.orgId),
      this.journey.orgTagNames(auth.orgId),
      this.journey.orgEnrollments(auth.orgId),
      this.journey.orgMilestones(auth.orgId),
      this.journey.orgGroupedMemberIds(auth.orgId),
      this.journey.orgAssessments(auth.orgId),
      this.scope.expandedScope(auth),
    ])
    const tagsByMember = new Map<string, string[]>()
    for (const t of tagRows) {
      const list = tagsByMember.get(t.memberId) ?? []
      list.push(t.name)
      tagsByMember.set(t.memberId, list)
    }
    return computePipeline(
      {
        members: allMembers.filter((m) => this.scope.memberVisible(scope, tagsByMember.get(m.id) ?? [])),
        tagsByMember,
        enrollments,
        milestones,
        groupedMemberIds: new Set(grouped),
        assessments,
      },
      query.stage,
      query.followUpDays,
      new Date(),
    )
  }
}
