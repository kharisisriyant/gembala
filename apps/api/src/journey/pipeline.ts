import type { JourneyStageRule, PipelineRowResponse, PipelineStage } from "@gembala/shared"
import type { AssessmentRow, EnrollmentRow, JourneyMember } from "./journey.repository"

export type PipelineInput = {
  members: JourneyMember[]
  tagsByMember: Map<string, string[]>
  enrollments: EnrollmentRow[]
  milestones: { memberId: string; type: string; achievedAt: string }[]
  groupedMemberIds: Set<string>
  // newest first, so the first entry per member is the current assessment
  assessments: AssessmentRow[]
  assignments?: { stageId: string; memberId: string; createdAt: Date }[]
}

export type ComputedStage = { id: string; rule: JourneyStageRule; reminderDays: number; courseKind: string | null }

const legacyStage = (id: PipelineStage, reminderDays: number): ComputedStage => ({
  id,
  rule: id === "newcomer_followup" ? "newcomer_followup" : id === "leader_candidate" ? "leadership_ready" : "course_completed",
  reminderDays: id === "newcomer_followup" ? reminderDays : 0,
  courseKind: id === "baptism_ready" ? "baptism_prep" : id === "sidi_ready" ? "sidi_prep" : null,
})

const DAY_MS = 24 * 60 * 60 * 1000

const startOfUtcDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))

// Whole calendar days between two instants (both truncated to their UTC day).
function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfUtcDay(to).getTime() - startOfUtcDay(from).getTime()) / DAY_MS)
}

const isoDay = (iso: string) => new Date(`${iso}T00:00:00Z`)

// Which members currently sit at a pipeline stage. Stages are derived from the
// milestone / enrollment / assessment records rather than stored, so they can
// never go stale. `members` must already be scope-filtered by the caller.
export function computePipeline(
  input: PipelineInput,
  rawStage: ComputedStage | PipelineStage,
  reminderOrNow: number | Date,
  maybeNow?: Date,
): PipelineRowResponse[] {
  const stage = typeof rawStage === "string" ? legacyStage(rawStage, typeof reminderOrNow === "number" ? reminderOrNow : 30) : rawStage
  const now = maybeNow ?? (reminderOrNow as Date)
  const today = startOfUtcDay(now)
  const rows: PipelineRowResponse[] = []

  const enrollmentsOf = (id: string) => input.enrollments.filter((e) => e.memberId === id)
  const milestonesOf = (id: string) => input.milestones.filter((m) => m.memberId === id)
  const row = (
    m: JourneyMember,
    extra: Partial<Pick<PipelineRowResponse, "daysSince" | "courseName" | "leadership">> = {},
  ): PipelineRowResponse => ({
    memberId: m.id,
    memberName: m.name,
    tags: [...(input.tagsByMember.get(m.id) ?? [])].sort(),
    stage: stage.id,
    daysSince: extra.daysSince ?? null,
    courseName: extra.courseName ?? null,
    leadership: extra.leadership ?? null,
  })

  const completionMilestone = (kind: string) => kind === "baptism_prep" ? "baptism" : kind === "sidi_prep" ? "sidi" : undefined
  const readiness = (m: JourneyMember, kind: string) => {
    const milestone = completionMilestone(kind)
    if (milestone && milestonesOf(m.id).some((ms) => ms.type === milestone)) return undefined
    const done = enrollmentsOf(m.id)
      .filter((e) => e.courseKind === kind && e.status === "completed")
      .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))[0]
    if (!done) return undefined
    if (done.completedAt && daysBetween(isoDay(done.completedAt), today) < stage.reminderDays) return undefined
    return row(m, {
      courseName: done.courseName,
      daysSince: done.completedAt ? daysBetween(isoDay(done.completedAt), today) : null,
    })
  }

  for (const m of input.members) {
    if (m.status === "inactive" || m.status === "moved") continue

    const manual = input.assignments?.find((a) => a.stageId === stage.id && a.memberId === m.id)
    if (manual) { rows.push(row(m, { daysSince: daysBetween(manual.createdAt, today) })); continue }
    if (stage.rule === "manual") continue
    if (stage.rule === "newcomer_followup") {
      if (m.status !== "newcomer") continue
      const days = daysBetween(isoDay(m.joinedAt), today)
      if (days < stage.reminderDays) continue
      const engaged =
        enrollmentsOf(m.id).length > 0 ||
        input.groupedMemberIds.has(m.id) ||
        milestonesOf(m.id).some((ms) => ms.type === "joined_class" || ms.type === "joined_group")
      if (!engaged) rows.push(row(m, { daysSince: days }))
    } else if (stage.rule === "course_completed") {
      if (stage.courseKind === "baptism_prep" && m.baptismStatus === "baptized") continue
      const r = readiness(m, stage.courseKind!)
      if (r) rows.push(r)
    } else if (stage.rule === "leadership_ready") {
      const current = input.assessments.find((a) => a.memberId === m.id)
      if (current?.level === "ready") {
        if (daysBetween(current.assessedAt, today) < stage.reminderDays) continue
        rows.push(
          row(m, {
            daysSince: daysBetween(current.assessedAt, today),
            leadership: { level: current.level, targetRole: current.targetRole },
          }),
        )
      }
    }
  }

  // Longest-waiting first; rows without a date sink to the bottom.
  return rows.sort(
    (a, b) => (b.daysSince ?? -1) - (a.daysSince ?? -1) || a.memberName.localeCompare(b.memberName),
  )
}
