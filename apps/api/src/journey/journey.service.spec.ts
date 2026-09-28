import { ConflictException, NotFoundException } from "@nestjs/common"
import { JourneyService } from "./journey.service"
import type { JourneyRepository, MilestoneRow, EnrollmentRow } from "./journey.repository"
import type { CoursesRepository } from "./courses.repository"
import type { MembersRepository } from "../members/members.repository"
import { ScopeService } from "../authz/scope.service"

const leader = { orgId: "org-1", userId: "u1", scopeTagNames: ["youth"] } as any
const admin = { orgId: "org-1", userId: "u0", scopeTagNames: null } as any

const member = { id: "m1", name: "Jo", status: "newcomer" as const, joinedAt: "2026-08-01", baptismStatus: "not_baptized" as const }

const milestone = (over: Partial<MilestoneRow> = {}): MilestoneRow => ({
  id: "ms1",
  memberId: "m1",
  type: "baptism",
  achievedAt: "2026-09-20",
  note: null,
  recordedById: "u1",
  recordedByName: "Lea",
  createdAt: new Date("2026-09-20T00:00:00Z"),
  ...over,
})

const enrollment = (over: Partial<EnrollmentRow> = {}): EnrollmentRow => ({
  id: "e1",
  memberId: "m1",
  courseId: "c1",
  courseName: "Baptism class",
  courseKind: "baptism_prep",
  status: "enrolled",
  startedAt: "2026-09-01",
  completedAt: null,
  ...over,
})

describe("JourneyService", () => {
  let journey: jest.Mocked<JourneyRepository>
  let courses: jest.Mocked<CoursesRepository>
  let members: jest.Mocked<MembersRepository>
  let service: JourneyService
  const db = { transaction: jest.fn((cb: (tx: unknown) => unknown) => cb("tx")) }

  beforeEach(() => {
    journey = {
      findMember: jest.fn().mockResolvedValue(member),
      tagNamesByMemberIds: jest.fn().mockResolvedValue([{ memberId: "m1", name: "youth" }]),
      listMilestones: jest.fn().mockResolvedValue([]),
      listEnrollments: jest.fn().mockResolvedValue([]),
      listAssessments: jest.fn().mockResolvedValue([]),
      findMilestoneById: jest.fn(),
      insertMilestone: jest.fn().mockResolvedValue({ id: "ms1" }),
      deleteMilestone: jest.fn(),
      latestBaptismDate: jest.fn(),
      findEnrollmentById: jest.fn(),
      findEnrollment: jest.fn(),
      insertEnrollment: jest.fn().mockResolvedValue({ id: "e1" }),
      updateEnrollment: jest.fn(),
      insertAssessment: jest.fn().mockResolvedValue({ id: "a1" }),
      findAssessmentById: jest.fn(),
      orgMembers: jest.fn(),
      orgTagNames: jest.fn(),
      orgEnrollments: jest.fn(),
      orgMilestones: jest.fn(),
      orgGroupedMemberIds: jest.fn(),
      orgAssessments: jest.fn(),
    } as unknown as jest.Mocked<JourneyRepository>
    courses = { findById: jest.fn() } as unknown as jest.Mocked<CoursesRepository>
    members = { update: jest.fn() } as unknown as jest.Mocked<MembersRepository>
    db.transaction.mockClear()
    const scope = new ScopeService({
      orgTags: jest.fn().mockResolvedValue([
        { id: "t1", name: "youth", parentId: null, description: null },
        { id: "t2", name: "elders", parentId: null, description: null },
      ]),
    } as any)
    service = new JourneyService(db as any, journey, courses, members, scope)
  })

  describe("scope", () => {
    it("404s for a missing member", async () => {
      journey.findMember.mockResolvedValue(undefined)
      await expect(service.getJourney(leader, "m1")).rejects.toBeInstanceOf(NotFoundException)
    })

    it("404s for an out-of-scope member; admin sees them", async () => {
      journey.tagNamesByMemberIds.mockResolvedValue([{ memberId: "m1", name: "elders" }])
      await expect(service.getJourney(leader, "m1")).rejects.toBeInstanceOf(NotFoundException)
      await expect(service.getJourney(admin, "m1")).resolves.toEqual({ milestones: [], enrollments: [], assessments: [] })
    })

    it("404s for an untagged member unless admin", async () => {
      journey.tagNamesByMemberIds.mockResolvedValue([])
      await expect(service.getJourney(leader, "m1")).rejects.toBeInstanceOf(NotFoundException)
    })
  })

  describe("addMilestone", () => {
    it("records the milestone with the actor", async () => {
      journey.findMilestoneById.mockResolvedValue(milestone({ type: "first_visit" }))
      await service.addMilestone(leader, "m1", { type: "first_visit", achievedAt: "2026-09-01" })
      expect(journey.insertMilestone).toHaveBeenCalledWith(
        expect.objectContaining({ orgId: "org-1", memberId: "m1", type: "first_visit", recordedByUserId: "u1", note: null }),
        "tx",
      )
      expect(members.update).not.toHaveBeenCalled()
    })

    it("syncs members.baptism* for a baptism milestone in the same transaction", async () => {
      journey.findMilestoneById.mockResolvedValue(milestone())
      await service.addMilestone(leader, "m1", { type: "baptism", achievedAt: "2026-09-20" })
      expect(members.update).toHaveBeenCalledWith(
        "org-1",
        "m1",
        { baptismStatus: "baptized", baptismDate: "2026-09-20" },
        "tx",
      )
    })

    it("404s and writes nothing for an out-of-scope member", async () => {
      journey.tagNamesByMemberIds.mockResolvedValue([{ memberId: "m1", name: "elders" }])
      await expect(
        service.addMilestone(leader, "m1", { type: "baptism", achievedAt: "2026-09-20" }),
      ).rejects.toBeInstanceOf(NotFoundException)
      expect(journey.insertMilestone).not.toHaveBeenCalled()
    })
  })

  describe("removeMilestone", () => {
    it("404s for a missing milestone", async () => {
      journey.findMilestoneById.mockResolvedValue(undefined)
      await expect(service.removeMilestone(admin, "ms1")).rejects.toBeInstanceOf(NotFoundException)
    })

    it("does not touch the member when the milestone is not a baptism", async () => {
      journey.findMilestoneById.mockResolvedValue(milestone({ type: "first_visit" }))
      await service.removeMilestone(admin, "ms1")
      expect(journey.deleteMilestone).toHaveBeenCalledWith("org-1", "ms1", "tx")
      expect(members.update).not.toHaveBeenCalled()
    })

    it("reverts baptism when the last baptism milestone is removed", async () => {
      journey.findMilestoneById.mockResolvedValue(milestone())
      journey.latestBaptismDate.mockResolvedValue(null)
      await service.removeMilestone(admin, "ms1")
      expect(members.update).toHaveBeenCalledWith(
        "org-1",
        "m1",
        { baptismStatus: "not_baptized", baptismDate: null },
        "tx",
      )
    })

    it("falls back to the remaining baptism date", async () => {
      journey.findMilestoneById.mockResolvedValue(milestone())
      journey.latestBaptismDate.mockResolvedValue("2026-01-05")
      await service.removeMilestone(admin, "ms1")
      expect(members.update).toHaveBeenCalledWith(
        "org-1",
        "m1",
        { baptismStatus: "baptized", baptismDate: "2026-01-05" },
        "tx",
      )
    })
  })

  describe("addEnrollment", () => {
    it("404s for a missing course", async () => {
      courses.findById.mockResolvedValue(undefined)
      await expect(service.addEnrollment(leader, "m1", { courseId: "c1" })).rejects.toBeInstanceOf(NotFoundException)
    })

    it("409s when already enrolled", async () => {
      courses.findById.mockResolvedValue({ id: "c1", name: "Baptism class", kind: "baptism_prep", enrollmentCount: 1 })
      journey.findEnrollment.mockResolvedValue({ id: "e0" })
      await expect(service.addEnrollment(leader, "m1", { courseId: "c1" })).rejects.toBeInstanceOf(ConflictException)
      expect(journey.insertEnrollment).not.toHaveBeenCalled()
    })

    it("enrolls and logs a joined_class milestone atomically", async () => {
      courses.findById.mockResolvedValue({ id: "c1", name: "Baptism class", kind: "baptism_prep", enrollmentCount: 0 })
      journey.findEnrollment.mockResolvedValue(undefined)
      journey.findEnrollmentById.mockResolvedValue(enrollment())
      await service.addEnrollment(leader, "m1", { courseId: "c1", startedAt: "2026-09-01" })
      expect(journey.insertEnrollment).toHaveBeenCalledWith(
        { orgId: "org-1", memberId: "m1", courseId: "c1", startedAt: "2026-09-01" },
        "tx",
      )
      expect(journey.insertMilestone).toHaveBeenCalledWith(
        expect.objectContaining({ type: "joined_class", achievedAt: "2026-09-01", note: "Baptism class" }),
        "tx",
      )
    })
  })

  describe("updateEnrollment", () => {
    it("404s for a missing or out-of-scope enrollment", async () => {
      journey.findEnrollmentById.mockResolvedValue(undefined)
      await expect(service.updateEnrollment(leader, "e1", { status: "completed" })).rejects.toBeInstanceOf(NotFoundException)
      journey.findEnrollmentById.mockResolvedValue(enrollment())
      journey.tagNamesByMemberIds.mockResolvedValue([{ memberId: "m1", name: "elders" }])
      await expect(service.updateEnrollment(leader, "e1", { status: "completed" })).rejects.toBeInstanceOf(NotFoundException)
    })

    it("stamps completedAt when completing, clears it otherwise", async () => {
      journey.findEnrollmentById.mockResolvedValue(enrollment())
      await service.updateEnrollment(leader, "e1", { status: "completed" })
      expect(journey.updateEnrollment).toHaveBeenLastCalledWith("org-1", "e1", {
        status: "completed",
        completedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      })
      await service.updateEnrollment(leader, "e1", { status: "dropped" })
      expect(journey.updateEnrollment).toHaveBeenLastCalledWith("org-1", "e1", { status: "dropped", completedAt: null })
    })

    it("keeps the original completion date when re-completing", async () => {
      journey.findEnrollmentById.mockResolvedValue(enrollment({ status: "completed", completedAt: "2026-09-10" }))
      await service.updateEnrollment(leader, "e1", { status: "completed" })
      expect(journey.updateEnrollment).toHaveBeenCalledWith("org-1", "e1", { status: "completed", completedAt: "2026-09-10" })
    })
  })

  describe("addAssessment", () => {
    it("appends an assessment attributed to the caller", async () => {
      journey.findAssessmentById.mockResolvedValue({
        id: "a1",
        memberId: "m1",
        level: "ready",
        targetRole: "cell_leader",
        note: null,
        assessedById: "u1",
        assessedByName: "Lea",
        assessedAt: new Date("2026-09-28T00:00:00Z"),
      })
      const res = await service.addAssessment(leader, "m1", { level: "ready", targetRole: "cell_leader" })
      expect(journey.insertAssessment).toHaveBeenCalledWith(
        expect.objectContaining({ orgId: "org-1", memberId: "m1", assessedByUserId: "u1" }),
      )
      expect(res.assessedBy).toEqual({ id: "u1", name: "Lea" })
    })
  })

  describe("pipeline", () => {
    it("only returns members inside the caller's scope", async () => {
      journey.orgMembers.mockResolvedValue([
        { ...member, id: "m1", name: "Visible", joinedAt: "2020-01-01" },
        { ...member, id: "m2", name: "Hidden", joinedAt: "2020-01-01" },
      ])
      journey.orgTagNames.mockResolvedValue([
        { memberId: "m1", name: "youth" },
        { memberId: "m2", name: "elders" },
      ])
      journey.orgEnrollments.mockResolvedValue([])
      journey.orgMilestones.mockResolvedValue([])
      journey.orgGroupedMemberIds.mockResolvedValue([])
      journey.orgAssessments.mockResolvedValue([])
      const rows = await service.pipeline(leader, { stage: "newcomer_followup", followUpDays: 30 })
      expect(rows.map((r) => r.memberName)).toEqual(["Visible"])
      const all = await service.pipeline(admin, { stage: "newcomer_followup", followUpDays: 30 })
      expect(all).toHaveLength(2)
    })
  })
})
