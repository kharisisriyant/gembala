import { z } from "zod"
import {
  careRequestSourceSchema,
  careRequestStatusSchema,
  careRequestTypeSchema,
  courseKindSchema,
  enrollmentStatusSchema,
  leadershipLevelSchema,
  leadershipTargetRoleSchema,
  milestoneTypeSchema,
  pipelineStageSchema,
  memberBaptismStatusSchema,
  memberGenderSchema,
  memberMaritalStatusSchema,
  memberRelationTypeSchema,
  memberStatusSchema,
  type AttendanceHeatmapResponse,
  type AuthResponse,
  type OrganizationInviteResponse,
  type CareRequestResponse,
  type CourseResponse,
  type DashboardResponse,
  type EventResponse,
  type GroupDetailResponse,
  type GroupSummaryResponse,
  type HouseholdCountResponse,
  type HouseholdResponse,
  type InstanceTypeResponse,
  type InvitePreviewResponse,
  type InviteResponse,
  type LeadershipAssessmentResponse,
  type MeResponse,
  type MemberDetailResponse,
  type MemberImportResult,
  type MemberJourneyResponse,
  type MemberRelationshipResponse,
  type MemberResponse,
  type MilestoneResponse,
  type PipelineRowResponse,
  type EnrollmentResponse,
  type RoleAssignmentResponse,
  type RoleResponse,
  type RoleTemplateResponse,
  type RoomResponse,
  type ScheduleEventDetailResponse,
  type ScheduleEventResponse,
  type ServiceInstanceResponse,
  type SessionResponse,
  type TagResponse,
  type TeamMemberResponse,
  type TelegramLinkStatusResponse,
} from "./schemas.js"

// Zod mirrors of the response types in schemas.ts. They exist so the API can
// generate OpenAPI response schemas; each `satisfies` clause keeps the schema
// assignable to its TypeScript type, so a drift fails the build.

const idName = z.object({ id: z.string().uuid(), name: z.string() })

export const meResponseSchema = z.object({
  isPlatformAdmin: z.boolean(),
  user: z.object({ id: z.string().uuid(), name: z.string(), email: z.string() }),
  org: idName,
  roles: z.array(idName),
  isSystemAdmin: z.boolean(),
  permissions: z
    .array(z.string())
    .describe('Resolved "resource:action" keys; empty when isSystemAdmin is true'),
  scopeTags: z.array(z.string()).nullable().describe("null = full access (system admin)"),
}) satisfies z.ZodType<MeResponse>

export const authResponseSchema = z.object({
  token: z.string().describe("JWT bearer token"),
  me: meResponseSchema,
}) satisfies z.ZodType<AuthResponse>

export const roleResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  isSystemAdmin: z.boolean(),
  permissions: z.array(z.string()),
  memberCount: z.number().int(),
}) satisfies z.ZodType<RoleResponse>

export const teamMemberResponseSchema = z.object({
  membershipId: z.string().uuid(),
  user: z.object({ id: z.string().uuid(), name: z.string(), email: z.string() }),
  roles: z.array(idName),
  scopeTags: z.array(z.string()).nullable(),
}) satisfies z.ZodType<TeamMemberResponse>

export const tagResponseSchema = z.object({
  name: z.string(),
  parent: z.string().nullable(),
  description: z.string().optional(),
  directCount: z.number().int().describe("Members tagged directly with this tag"),
  subtreeCount: z.number().int().describe("Members tagged with this tag or any descendant"),
}) satisfies z.ZodType<TagResponse>

export const memberResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string(),
  phone: z.string(),
  tags: z.array(z.string()),
  status: memberStatusSchema,
  joinedAt: z.string().describe("ISO date (YYYY-MM-DD)"),
  dateOfBirth: z.string().nullable(),
  gender: memberGenderSchema.nullable(),
  maritalStatus: memberMaritalStatusSchema.nullable(),
  address: z.string(),
  occupation: z.string(),
  notes: z.string(),
  photoUrl: z.string(),
  baptismStatus: memberBaptismStatusSchema.nullable(),
  baptismDate: z.string().nullable(),
}) satisfies z.ZodType<MemberResponse>

export const memberDetailResponseSchema = memberResponseSchema.extend({
  groups: z.array(idName),
}) satisfies z.ZodType<MemberDetailResponse>

export const memberImportResultSchema = z.object({
  created: z.array(memberResponseSchema),
  errors: z.array(z.object({ row: z.number().int(), name: z.string(), message: z.string() })),
}) satisfies z.ZodType<MemberImportResult>

export const memberRelationshipResponseSchema = z.object({
  relatedMemberId: z.string().uuid(),
  relatedMemberName: z.string(),
  relationType: memberRelationTypeSchema,
  label: z
    .string()
    .describe("Human-readable, resolved relative to the member whose relationships were requested"),
}) satisfies z.ZodType<MemberRelationshipResponse>

export const householdResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  address: z.string(),
  primaryContact: idName.nullable(),
  members: z.array(idName),
  memberCount: z.number().int(),
}) satisfies z.ZodType<HouseholdResponse>

export const householdCountResponseSchema = z.object({
  totalFamilies: z.number().int(),
}) satisfies z.ZodType<HouseholdCountResponse>

export const groupSummaryResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  leader: idName.nullable(),
  scopeTag: z.string(),
  members: z.array(idName),
  memberCount: z.number().int(),
  schedule: z.string(),
  location: z.string(),
  lastSessionDate: z.string().nullable(),
  lastSessionPresent: z.number().int().nullable(),
}) satisfies z.ZodType<GroupSummaryResponse>

export const sessionResponseSchema = z.object({
  id: z.string().uuid(),
  groupId: z.string().uuid(),
  date: z.string(),
  presentIds: z.array(z.string().uuid()),
  topic: z.string(),
  prayerNotes: z.string(),
}) satisfies z.ZodType<SessionResponse>

export const groupDetailResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  leader: idName.nullable(),
  scopeTag: z.string(),
  schedule: z.string(),
  location: z.string(),
  members: z.array(memberResponseSchema),
  sessions: z.array(sessionResponseSchema),
  stats: z.object({
    meetingsLogged: z.number().int(),
    avgAttendance: z.number(),
    memberCount: z.number().int(),
  }),
}) satisfies z.ZodType<GroupDetailResponse>

export const attendanceHeatmapResponseSchema = z.object({
  weeks: z.array(z.object({ start: z.string(), end: z.string() })),
  groups: z.array(
    z.object({
      groupId: z.string().uuid(),
      groupName: z.string(),
      memberCount: z.number().int(),
      cells: z.array(
        z.object({
          rate: z.number().nullable(),
          present: z.number().int(),
          sessions: z.number().int(),
        }),
      ),
    }),
  ),
}) satisfies z.ZodType<AttendanceHeatmapResponse>

export const roomResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  capacity: z.number().int().nullable(),
  description: z.string(),
  isActive: z.boolean(),
}) satisfies z.ZodType<RoomResponse>

export const eventResponseSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  startAt: z.string().describe("ISO 8601 timestamp"),
  endAt: z.string().describe("ISO 8601 timestamp"),
  isPublic: z.boolean(),
  room: idName.nullable(),
}) satisfies z.ZodType<EventResponse>

export const instanceTypeResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
}) satisfies z.ZodType<InstanceTypeResponse>

export const roleTemplateResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
}) satisfies z.ZodType<RoleTemplateResponse>

export const scheduleEventResponseSchema = z.object({
  id: z.string().uuid(),
  date: z.string(),
  scriptureRef: z.string(),
  theme: z.string(),
}) satisfies z.ZodType<ScheduleEventResponse>

export const serviceInstanceResponseSchema = z.object({
  id: z.string().uuid(),
  eventId: z.string().uuid(),
  instanceType: idName,
  sortOrder: z.number().int(),
}) satisfies z.ZodType<ServiceInstanceResponse>

export const roleAssignmentResponseSchema = z.object({
  id: z.string().uuid(),
  roleTemplateId: z.string().uuid(),
  member: idName.nullable(),
  freeText: z.string(),
  sortOrder: z.number().int(),
}) satisfies z.ZodType<RoleAssignmentResponse>

export const scheduleEventDetailResponseSchema = scheduleEventResponseSchema.extend({
  instances: z.array(
    serviceInstanceResponseSchema.extend({ assignments: z.array(roleAssignmentResponseSchema) }),
  ),
}) satisfies z.ZodType<ScheduleEventDetailResponse>

export const inviteResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string(),
  roles: z.array(idName),
  scopeTags: z.array(z.string()),
  status: z.enum(["pending", "accepted", "revoked", "expired"]),
  createdAt: z.string(),
  expiresAt: z.string(),
}) satisfies z.ZodType<InviteResponse>

export const invitePreviewResponseSchema = z.object({
  orgName: z.string(),
  email: z.string(),
  roles: z.array(idName),
  scopeTags: z.array(z.string()),
}) satisfies z.ZodType<InvitePreviewResponse>

export const dashboardResponseSchema = z.object({
  memberCount: z.number().int(),
  activeCount: z.number().int(),
  newcomerCount: z.number().int(),
  groupCount: z.number().int(),
  avgAttendance: z.number(),
  recentSessions: z.array(
    z.object({
      id: z.string().uuid(),
      groupId: z.string().uuid(),
      groupName: z.string(),
      date: z.string(),
      topic: z.string(),
      presentCount: z.number().int(),
      presentNames: z.array(z.string()),
    }),
  ),
  tagHistogram: z.array(z.object({ tag: z.string(), count: z.number().int() })),
  prayerNotes: z.array(z.object({ groupName: z.string(), date: z.string(), notes: z.string() })),
}) satisfies z.ZodType<DashboardResponse>

export const telegramLinkStatusResponseSchema = z.discriminatedUnion("linked", [
  z.object({ linked: z.literal(true), telegramUsername: z.string().nullable() }),
  z.object({
    linked: z.literal(false),
    code: z.string().describe("One-time code to send to the bot as /link <code>"),
    expiresAt: z.string(),
    botConfigured: z.boolean(),
    botUsername: z.string().nullable(),
  }),
]) satisfies z.ZodType<TelegramLinkStatusResponse>

const careRequestUserRefSchema = z.object({ id: z.string().uuid(), name: z.string() })

export const careRequestResponseSchema = z.object({
  id: z.string().uuid(),
  memberId: z.string().uuid(),
  memberName: z.string(),
  type: careRequestTypeSchema,
  body: z.string(),
  status: careRequestStatusSchema,
  source: careRequestSourceSchema,
  submittedBy: careRequestUserRefSchema.nullable(),
  closedAt: z.string().nullable().describe("ISO 8601 timestamp"),
  closedBy: careRequestUserRefSchema.nullable(),
  closeNote: z.string().nullable(),
  createdAt: z.string().describe("ISO 8601 timestamp"),
  updatedAt: z.string().describe("ISO 8601 timestamp"),
}) satisfies z.ZodType<CareRequestResponse>

const journeyUserRefSchema = z.object({ id: z.string().uuid(), name: z.string() })

export const courseResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  kind: courseKindSchema,
  enrollmentCount: z.number().int(),
}) satisfies z.ZodType<CourseResponse>

export const milestoneResponseSchema = z.object({
  id: z.string().uuid(),
  memberId: z.string().uuid(),
  type: milestoneTypeSchema,
  achievedAt: z.string().describe("ISO date (YYYY-MM-DD)"),
  note: z.string().nullable(),
  recordedBy: journeyUserRefSchema.nullable(),
  createdAt: z.string().describe("ISO 8601 timestamp"),
}) satisfies z.ZodType<MilestoneResponse>

export const enrollmentResponseSchema = z.object({
  id: z.string().uuid(),
  memberId: z.string().uuid(),
  course: z.object({ id: z.string().uuid(), name: z.string(), kind: courseKindSchema }),
  status: enrollmentStatusSchema,
  startedAt: z.string().describe("ISO date (YYYY-MM-DD)"),
  completedAt: z.string().nullable().describe("ISO date (YYYY-MM-DD)"),
}) satisfies z.ZodType<EnrollmentResponse>

export const leadershipAssessmentResponseSchema = z.object({
  id: z.string().uuid(),
  memberId: z.string().uuid(),
  level: leadershipLevelSchema,
  targetRole: leadershipTargetRoleSchema,
  note: z.string().nullable(),
  assessedBy: journeyUserRefSchema.nullable(),
  assessedAt: z.string().describe("ISO 8601 timestamp"),
}) satisfies z.ZodType<LeadershipAssessmentResponse>

export const memberJourneyResponseSchema = z.object({
  milestones: z.array(milestoneResponseSchema),
  enrollments: z.array(enrollmentResponseSchema),
  assessments: z
    .array(leadershipAssessmentResponseSchema)
    .describe("Newest first; the first entry is the current assessment"),
}) satisfies z.ZodType<MemberJourneyResponse>

export const pipelineRowResponseSchema = z.object({
  memberId: z.string().uuid(),
  memberName: z.string(),
  tags: z.array(z.string()),
  stage: pipelineStageSchema,
  daysSince: z.number().int().nullable().describe("Days since joining (follow-up) or since course completion (readiness)"),
  courseName: z.string().nullable().describe("The completed prep course, for baptism/sidi readiness"),
  leadership: z
    .object({ level: leadershipLevelSchema, targetRole: leadershipTargetRoleSchema })
    .nullable(),
}) satisfies z.ZodType<PipelineRowResponse>

export const organizationInviteResponseSchema = z.object({
  id: z.string().uuid(), email: z.string().email(), url: z.string().url(), expiresAt: z.string(),
}) satisfies z.ZodType<OrganizationInviteResponse>
