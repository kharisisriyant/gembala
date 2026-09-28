import { computePipeline, type PipelineInput } from "./pipeline"
import type { AssessmentRow, EnrollmentRow, JourneyMember } from "./journey.repository"

const NOW = new Date("2026-09-28T10:00:00Z")

const member = (over: Partial<JourneyMember> = {}): JourneyMember => ({
  id: "m1",
  name: "Jo",
  status: "newcomer",
  joinedAt: "2026-08-01",
  baptismStatus: "not_baptized",
  ...over,
})

const enrollment = (over: Partial<EnrollmentRow> = {}): EnrollmentRow => ({
  id: "e1",
  memberId: "m1",
  courseId: "c1",
  courseName: "Baptism class",
  courseKind: "baptism_prep",
  status: "completed",
  startedAt: "2026-08-01",
  completedAt: "2026-09-18",
  ...over,
})

const assessment = (over: Partial<AssessmentRow> = {}): AssessmentRow => ({
  id: "a1",
  memberId: "m1",
  level: "ready",
  targetRole: "cell_leader",
  note: null,
  assessedById: null,
  assessedByName: null,
  assessedAt: new Date("2026-09-08T00:00:00Z"),
  ...over,
})

const input = (over: Partial<PipelineInput> = {}): PipelineInput => ({
  members: [member()],
  tagsByMember: new Map([["m1", ["youth", "alpha"]]]),
  enrollments: [],
  milestones: [],
  groupedMemberIds: new Set(),
  assessments: [],
  ...over,
})

describe("computePipeline", () => {
  describe("newcomer_followup", () => {
    it("lists a newcomer past the threshold with no class or group", () => {
      const rows = computePipeline(input(), "newcomer_followup", 30, NOW)
      expect(rows).toEqual([
        expect.objectContaining({ memberId: "m1", daysSince: 58, tags: ["alpha", "youth"] }),
      ])
    })

    it("skips newcomers inside the threshold", () => {
      const rows = computePipeline(input({ members: [member({ joinedAt: "2026-09-20" })] }), "newcomer_followup", 30, NOW)
      expect(rows).toEqual([])
    })

    it("skips newcomers that are already engaged", () => {
      expect(computePipeline(input({ enrollments: [enrollment({ status: "enrolled" })] }), "newcomer_followup", 30, NOW)).toEqual([])
      expect(computePipeline(input({ groupedMemberIds: new Set(["m1"]) }), "newcomer_followup", 30, NOW)).toEqual([])
      expect(
        computePipeline(
          input({ milestones: [{ memberId: "m1", type: "joined_group", achievedAt: "2026-09-01" }] }),
          "newcomer_followup",
          30,
          NOW,
        ),
      ).toEqual([])
    })

    it("skips non-newcomers", () => {
      expect(computePipeline(input({ members: [member({ status: "active" })] }), "newcomer_followup", 30, NOW)).toEqual([])
    })
  })

  describe("baptism_ready / sidi_ready", () => {
    it("lists a member who completed baptism prep with no baptism milestone", () => {
      const rows = computePipeline(input({ enrollments: [enrollment()] }), "baptism_ready", 30, NOW)
      expect(rows).toEqual([expect.objectContaining({ memberId: "m1", courseName: "Baptism class", daysSince: 10 })])
    })

    it("skips members already baptized (status or milestone)", () => {
      expect(
        computePipeline(
          input({ members: [member({ baptismStatus: "baptized" })], enrollments: [enrollment()] }),
          "baptism_ready",
          30,
          NOW,
        ),
      ).toEqual([])
      expect(
        computePipeline(
          input({
            enrollments: [enrollment()],
            milestones: [{ memberId: "m1", type: "baptism", achievedAt: "2026-09-20" }],
          }),
          "baptism_ready",
          30,
          NOW,
        ),
      ).toEqual([])
    })

    it("ignores incomplete enrollments and other course kinds", () => {
      expect(computePipeline(input({ enrollments: [enrollment({ status: "enrolled", completedAt: null })] }), "baptism_ready", 30, NOW)).toEqual([])
      expect(computePipeline(input({ enrollments: [enrollment({ courseKind: "discipleship" })] }), "baptism_ready", 30, NOW)).toEqual([])
    })

    it("uses sidi_prep and the sidi milestone for sidi_ready", () => {
      const sidi = enrollment({ courseKind: "sidi_prep", courseName: "Sidi class" })
      expect(computePipeline(input({ enrollments: [sidi] }), "sidi_ready", 30, NOW)).toHaveLength(1)
      expect(
        computePipeline(
          input({ enrollments: [sidi], milestones: [{ memberId: "m1", type: "sidi", achievedAt: "2026-09-25" }] }),
          "sidi_ready",
          30,
          NOW,
        ),
      ).toEqual([])
    })
  })

  describe("leader_candidate", () => {
    it("lists members whose latest assessment is ready", () => {
      const rows = computePipeline(input({ assessments: [assessment()] }), "leader_candidate", 30, NOW)
      expect(rows).toEqual([
        expect.objectContaining({ memberId: "m1", daysSince: 20, leadership: { level: "ready", targetRole: "cell_leader" } }),
      ])
    })

    it("counts an assessment made earlier today as 0 days, never negative", () => {
      const today = assessment({ assessedAt: new Date("2026-09-28T09:59:00Z") })
      const rows = computePipeline(input({ assessments: [today] }), "leader_candidate", 30, NOW)
      expect(rows[0].daysSince).toBe(0)
    })

    it("uses only the newest assessment", () => {
      const newer = assessment({ id: "a2", level: "emerging", assessedAt: new Date("2026-09-20T00:00:00Z") })
      expect(computePipeline(input({ assessments: [newer, assessment()] }), "leader_candidate", 30, NOW)).toEqual([])
    })
  })

  it("excludes inactive and moved members from every stage", () => {
    const inactive = input({ members: [member({ status: "inactive" })], assessments: [assessment()] })
    expect(computePipeline(inactive, "leader_candidate", 30, NOW)).toEqual([])
  })

  it("orders longest-waiting first", () => {
    const rows = computePipeline(
      input({
        members: [
          member({ id: "m1", name: "Recent", joinedAt: "2026-08-20" }),
          member({ id: "m2", name: "Old", joinedAt: "2026-06-01" }),
        ],
      }),
      "newcomer_followup",
      30,
      NOW,
    )
    expect(rows.map((r) => r.memberName)).toEqual(["Old", "Recent"])
  })
})
