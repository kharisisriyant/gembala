import type { PipelineRowResponse, PipelineStage } from "@gembala/shared"
import type { AssessmentRow, EnrollmentRow, JourneyMember } from "./journey.repository"

export type PipelineInput = {
  members: JourneyMember[]
  tagsByMember: Map<string, string[]>
  enrollments: EnrollmentRow[]
  milestones: { memberId: string; type: string; achievedAt: string }[]
  groupedMemberIds: Set<string>
  // newest first, so the first entry per member is the current assessment
  assessments: AssessmentRow[]
}

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
  stage: PipelineStage,
  followUpDays: number,
  now: Date,
): PipelineRowResponse[] {
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
    stage,
    daysSince: extra.daysSince ?? null,
    courseName: extra.courseName ?? null,
    leadership: extra.leadership ?? null,
  })

  // "ready" stages: the latest completed prep course of `kind`, and no matching milestone yet.
  const readiness = (m: JourneyMember, kind: "baptism_prep" | "sidi_prep", milestone: "baptism" | "sidi") => {
    if (milestonesOf(m.id).some((ms) => ms.type === milestone)) return undefined
    const done = enrollmentsOf(m.id)
      .filter((e) => e.courseKind === kind && e.status === "completed")
      .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))[0]
    if (!done) return undefined
    return row(m, {
      courseName: done.courseName,
      daysSince: done.completedAt ? daysBetween(isoDay(done.completedAt), today) : null,
    })
  }

  for (const m of input.members) {
    if (m.status === "inactive" || m.status === "moved") continue

    if (stage === "newcomer_followup") {
      if (m.status !== "newcomer") continue
      const days = daysBetween(isoDay(m.joinedAt), today)
      if (days < followUpDays) continue
      const engaged =
        enrollmentsOf(m.id).length > 0 ||
        input.groupedMemberIds.has(m.id) ||
        milestonesOf(m.id).some((ms) => ms.type === "joined_class" || ms.type === "joined_group")
      if (!engaged) rows.push(row(m, { daysSince: days }))
    } else if (stage === "baptism_ready") {
      if (m.baptismStatus === "baptized") continue
      const r = readiness(m, "baptism_prep", "baptism")
      if (r) rows.push(r)
    } else if (stage === "sidi_ready") {
      const r = readiness(m, "sidi_prep", "sidi")
      if (r) rows.push(r)
    } else {
      const current = input.assessments.find((a) => a.memberId === m.id)
      if (current?.level === "ready") {
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
