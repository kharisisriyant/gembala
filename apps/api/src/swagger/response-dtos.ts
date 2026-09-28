import { createZodDto } from "nestjs-zod"
import {
  attendanceHeatmapResponseSchema,
  authResponseSchema,
  dashboardResponseSchema,
  eventResponseSchema,
  groupDetailResponseSchema,
  groupSummaryResponseSchema,
  householdCountResponseSchema,
  householdResponseSchema,
  instanceTypeResponseSchema,
  invitePreviewResponseSchema,
  inviteResponseSchema,
  meResponseSchema,
  memberDetailResponseSchema,
  memberImportResultSchema,
  memberRelationshipResponseSchema,
  memberResponseSchema,
  roleAssignmentResponseSchema,
  roleResponseSchema,
  roleTemplateResponseSchema,
  roomResponseSchema,
  scheduleEventDetailResponseSchema,
  serviceInstanceResponseSchema,
  sessionResponseSchema,
  tagResponseSchema,
  teamMemberResponseSchema,
} from "@gembala/shared"

// Response-side DTOs, used only by @nestjs/swagger decorators to describe
// what controllers return. Request DTOs live next to their controllers.

export class AuthResponseDto extends createZodDto(authResponseSchema) {}
export class MeResponseDto extends createZodDto(meResponseSchema) {}
export class RoleResponseDto extends createZodDto(roleResponseSchema) {}
export class TeamMemberResponseDto extends createZodDto(teamMemberResponseSchema) {}
export class TagResponseDto extends createZodDto(tagResponseSchema) {}
export class MemberResponseDto extends createZodDto(memberResponseSchema) {}
export class MemberDetailResponseDto extends createZodDto(memberDetailResponseSchema) {}
export class MemberImportResultDto extends createZodDto(memberImportResultSchema) {}
export class MemberRelationshipResponseDto extends createZodDto(memberRelationshipResponseSchema) {}
export class HouseholdResponseDto extends createZodDto(householdResponseSchema) {}
export class HouseholdCountResponseDto extends createZodDto(householdCountResponseSchema) {}
export class GroupSummaryResponseDto extends createZodDto(groupSummaryResponseSchema) {}
export class GroupDetailResponseDto extends createZodDto(groupDetailResponseSchema) {}
export class SessionResponseDto extends createZodDto(sessionResponseSchema) {}
export class AttendanceHeatmapResponseDto extends createZodDto(attendanceHeatmapResponseSchema) {}
export class RoomResponseDto extends createZodDto(roomResponseSchema) {}
export class EventResponseDto extends createZodDto(eventResponseSchema) {}
export class InstanceTypeResponseDto extends createZodDto(instanceTypeResponseSchema) {}
export class RoleTemplateResponseDto extends createZodDto(roleTemplateResponseSchema) {}
export class ServiceInstanceResponseDto extends createZodDto(serviceInstanceResponseSchema) {}
export class RoleAssignmentResponseDto extends createZodDto(roleAssignmentResponseSchema) {}
export class ScheduleEventDetailResponseDto extends createZodDto(scheduleEventDetailResponseSchema) {}
export class InviteResponseDto extends createZodDto(inviteResponseSchema) {}
export class InvitePreviewResponseDto extends createZodDto(invitePreviewResponseSchema) {}
export class DashboardResponseDto extends createZodDto(dashboardResponseSchema) {}
