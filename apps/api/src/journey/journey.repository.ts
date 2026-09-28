import { Injectable } from "@nestjs/common"
import { and, desc, eq, inArray, max } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"
import { InjectDb, type Db, type Tx } from "../db/drizzle.module"
import {
  courseEnrollments,
  courses,
  groupMembers,
  groups,
  leadershipAssessments,
  memberMilestones,
  members,
  memberTags,
  tags,
  users,
} from "../db/schema"

export type MilestoneInsert = typeof memberMilestones.$inferInsert
export type EnrollmentInsert = typeof courseEnrollments.$inferInsert
export type EnrollmentPatch = Partial<Pick<EnrollmentInsert, "status" | "completedAt">>
export type AssessmentInsert = typeof leadershipAssessments.$inferInsert

type MilestoneType = (typeof memberMilestones.$inferSelect)["type"]
type CourseKind = (typeof courses.$inferSelect)["kind"]
type EnrollmentStatus = (typeof courseEnrollments.$inferSelect)["status"]
type LeadershipLevel = (typeof leadershipAssessments.$inferSelect)["level"]
type LeadershipTargetRole = (typeof leadershipAssessments.$inferSelect)["targetRole"]

export type JourneyMember = {
  id: string
  name: string
  status: (typeof members.$inferSelect)["status"]
  joinedAt: string
  baptismStatus: (typeof members.$inferSelect)["baptismStatus"]
}

export type MilestoneRow = {
  id: string
  memberId: string
  type: MilestoneType
  achievedAt: string
  note: string | null
  recordedById: string | null
  recordedByName: string | null
  createdAt: Date
}

export type EnrollmentRow = {
  id: string
  memberId: string
  courseId: string
  courseName: string
  courseKind: CourseKind
  status: EnrollmentStatus
  startedAt: string
  completedAt: string | null
}

export type AssessmentRow = {
  id: string
  memberId: string
  level: LeadershipLevel
  targetRole: LeadershipTargetRole
  note: string | null
  assessedById: string | null
  assessedByName: string | null
  assessedAt: Date
}

const recorder = alias(users, "recorder")
const assessor = alias(users, "assessor")

const milestoneShape = {
  id: memberMilestones.id,
  memberId: memberMilestones.memberId,
  type: memberMilestones.type,
  achievedAt: memberMilestones.achievedAt,
  note: memberMilestones.note,
  recordedById: memberMilestones.recordedByUserId,
  recordedByName: recorder.name,
  createdAt: memberMilestones.createdAt,
}

const enrollmentShape = {
  id: courseEnrollments.id,
  memberId: courseEnrollments.memberId,
  courseId: courseEnrollments.courseId,
  courseName: courses.name,
  courseKind: courses.kind,
  status: courseEnrollments.status,
  startedAt: courseEnrollments.startedAt,
  completedAt: courseEnrollments.completedAt,
}

const assessmentShape = {
  id: leadershipAssessments.id,
  memberId: leadershipAssessments.memberId,
  level: leadershipAssessments.level,
  targetRole: leadershipAssessments.targetRole,
  note: leadershipAssessments.note,
  assessedById: leadershipAssessments.assessedByUserId,
  assessedByName: assessor.name,
  assessedAt: leadershipAssessments.assessedAt,
}

@Injectable()
export class JourneyRepository {
  constructor(@InjectDb() private readonly db: Db) {}

  // ---- members / tags ------------------------------------------------------

  async findMember(orgId: string, memberId: string, tx: Db | Tx = this.db): Promise<JourneyMember | undefined> {
    const [row] = await tx
      .select({
        id: members.id,
        name: members.name,
        status: members.status,
        joinedAt: members.joinedAt,
        baptismStatus: members.baptismStatus,
      })
      .from(members)
      .where(and(eq(members.orgId, orgId), eq(members.id, memberId)))
    return row
  }

  async tagNamesByMemberIds(memberIds: string[], tx: Db | Tx = this.db) {
    if (memberIds.length === 0) return []
    return tx
      .select({ memberId: memberTags.memberId, name: tags.name })
      .from(memberTags)
      .innerJoin(tags, eq(tags.id, memberTags.tagId))
      .where(inArray(memberTags.memberId, memberIds))
  }

  // ---- milestones ----------------------------------------------------------

  private milestoneSelect(tx: Db | Tx) {
    return tx
      .select(milestoneShape)
      .from(memberMilestones)
      .leftJoin(recorder, eq(recorder.id, memberMilestones.recordedByUserId))
  }

  async listMilestones(orgId: string, memberId: string, tx: Db | Tx = this.db): Promise<MilestoneRow[]> {
    return this.milestoneSelect(tx)
      .where(and(eq(memberMilestones.orgId, orgId), eq(memberMilestones.memberId, memberId)))
      .orderBy(desc(memberMilestones.achievedAt), desc(memberMilestones.createdAt))
  }

  async findMilestoneById(orgId: string, id: string, tx: Db | Tx = this.db): Promise<MilestoneRow | undefined> {
    const [row] = await this.milestoneSelect(tx).where(
      and(eq(memberMilestones.orgId, orgId), eq(memberMilestones.id, id)),
    )
    return row
  }

  async insertMilestone(input: MilestoneInsert, tx: Db | Tx = this.db) {
    const [row] = await tx.insert(memberMilestones).values(input).returning({ id: memberMilestones.id })
    return row
  }

  async deleteMilestone(orgId: string, id: string, tx: Db | Tx = this.db) {
    await tx
      .delete(memberMilestones)
      .where(and(eq(memberMilestones.orgId, orgId), eq(memberMilestones.id, id)))
  }

  // Most recent baptism milestone date still on file, used to re-sync
  // members.baptismDate after a baptism milestone is deleted.
  async latestBaptismDate(memberId: string, tx: Db | Tx = this.db): Promise<string | null> {
    const [row] = await tx
      .select({ date: max(memberMilestones.achievedAt) })
      .from(memberMilestones)
      .where(and(eq(memberMilestones.memberId, memberId), eq(memberMilestones.type, "baptism")))
    return row?.date ?? null
  }

  // ---- enrollments ---------------------------------------------------------

  private enrollmentSelect(tx: Db | Tx) {
    return tx
      .select(enrollmentShape)
      .from(courseEnrollments)
      .innerJoin(courses, eq(courses.id, courseEnrollments.courseId))
  }

  async listEnrollments(orgId: string, memberId: string, tx: Db | Tx = this.db): Promise<EnrollmentRow[]> {
    return this.enrollmentSelect(tx)
      .where(and(eq(courseEnrollments.orgId, orgId), eq(courseEnrollments.memberId, memberId)))
      .orderBy(desc(courseEnrollments.startedAt))
  }

  async findEnrollmentById(orgId: string, id: string, tx: Db | Tx = this.db): Promise<EnrollmentRow | undefined> {
    const [row] = await this.enrollmentSelect(tx).where(
      and(eq(courseEnrollments.orgId, orgId), eq(courseEnrollments.id, id)),
    )
    return row
  }

  async findEnrollment(
    memberId: string,
    courseId: string,
    tx: Db | Tx = this.db,
  ): Promise<{ id: string } | undefined> {
    const [row] = await tx
      .select({ id: courseEnrollments.id })
      .from(courseEnrollments)
      .where(and(eq(courseEnrollments.memberId, memberId), eq(courseEnrollments.courseId, courseId)))
    return row
  }

  async insertEnrollment(input: EnrollmentInsert, tx: Db | Tx = this.db) {
    const [row] = await tx.insert(courseEnrollments).values(input).returning({ id: courseEnrollments.id })
    return row
  }

  async updateEnrollment(orgId: string, id: string, patch: EnrollmentPatch, tx: Db | Tx = this.db) {
    await tx
      .update(courseEnrollments)
      .set(patch)
      .where(and(eq(courseEnrollments.orgId, orgId), eq(courseEnrollments.id, id)))
  }

  // ---- leadership assessments ---------------------------------------------

  private assessmentSelect(tx: Db | Tx) {
    return tx
      .select(assessmentShape)
      .from(leadershipAssessments)
      .leftJoin(assessor, eq(assessor.id, leadershipAssessments.assessedByUserId))
  }

  async listAssessments(orgId: string, memberId: string, tx: Db | Tx = this.db): Promise<AssessmentRow[]> {
    return this.assessmentSelect(tx)
      .where(and(eq(leadershipAssessments.orgId, orgId), eq(leadershipAssessments.memberId, memberId)))
      .orderBy(desc(leadershipAssessments.assessedAt))
  }

  async findAssessmentById(orgId: string, id: string, tx: Db | Tx = this.db): Promise<AssessmentRow | undefined> {
    const [row] = await this.assessmentSelect(tx).where(
      and(eq(leadershipAssessments.orgId, orgId), eq(leadershipAssessments.id, id)),
    )
    return row
  }

  async insertAssessment(input: AssessmentInsert, tx: Db | Tx = this.db) {
    const [row] = await tx.insert(leadershipAssessments).values(input).returning({ id: leadershipAssessments.id })
    return row
  }

  // ---- org-wide reads for the pipeline ------------------------------------

  async orgMembers(orgId: string, tx: Db | Tx = this.db): Promise<JourneyMember[]> {
    return tx
      .select({
        id: members.id,
        name: members.name,
        status: members.status,
        joinedAt: members.joinedAt,
        baptismStatus: members.baptismStatus,
      })
      .from(members)
      .where(eq(members.orgId, orgId))
  }

  async orgTagNames(orgId: string, tx: Db | Tx = this.db) {
    return tx
      .select({ memberId: memberTags.memberId, name: tags.name })
      .from(memberTags)
      .innerJoin(tags, eq(tags.id, memberTags.tagId))
      .innerJoin(members, eq(members.id, memberTags.memberId))
      .where(eq(members.orgId, orgId))
  }

  async orgEnrollments(orgId: string, tx: Db | Tx = this.db): Promise<EnrollmentRow[]> {
    return this.enrollmentSelect(tx).where(eq(courseEnrollments.orgId, orgId))
  }

  async orgMilestones(orgId: string, tx: Db | Tx = this.db) {
    return tx
      .select({
        memberId: memberMilestones.memberId,
        type: memberMilestones.type,
        achievedAt: memberMilestones.achievedAt,
      })
      .from(memberMilestones)
      .where(eq(memberMilestones.orgId, orgId))
  }

  async orgGroupedMemberIds(orgId: string, tx: Db | Tx = this.db): Promise<string[]> {
    const rows = await tx
      .selectDistinct({ memberId: groupMembers.memberId })
      .from(groupMembers)
      .innerJoin(groups, eq(groups.id, groupMembers.groupId))
      .where(eq(groups.orgId, orgId))
    return rows.map((r) => r.memberId)
  }

  async orgAssessments(orgId: string, tx: Db | Tx = this.db): Promise<AssessmentRow[]> {
    return this.assessmentSelect(tx)
      .where(eq(leadershipAssessments.orgId, orgId))
      .orderBy(desc(leadershipAssessments.assessedAt))
  }
}
