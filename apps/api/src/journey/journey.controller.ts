import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common"
import { createZodDto } from "nestjs-zod"
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger"
import {
  enrollmentCreateSchema,
  enrollmentUpdateSchema,
  leadershipAssessmentCreateSchema,
  milestoneCreateSchema,
  pipelineQuerySchema,
  type EnrollmentResponse,
  type LeadershipAssessmentResponse,
  type MemberJourneyResponse,
  type MilestoneResponse,
  type PipelineRowResponse,
} from "@gembala/shared"
import {
  EnrollmentResponseDto,
  LeadershipAssessmentResponseDto,
  MemberJourneyResponseDto,
  MilestoneResponseDto,
  PipelineRowResponseDto,
} from "../swagger/response-dtos"
import { CurrentAuth, RequirePermission } from "../authz/decorators"
import type { AuthContext } from "../authz/auth-context"
import { JourneyService } from "./journey.service"

class MilestoneCreateDto extends createZodDto(milestoneCreateSchema) {}
class EnrollmentCreateDto extends createZodDto(enrollmentCreateSchema) {}
class EnrollmentUpdateDto extends createZodDto(enrollmentUpdateSchema) {}
class LeadershipAssessmentCreateDto extends createZodDto(leadershipAssessmentCreateSchema) {}
class PipelineQueryDto extends createZodDto(pipelineQuerySchema) {}

const MEMBER_NOT_FOUND = "Member not found or outside the caller's tag scope"

@ApiTags("Journey")
@Controller()
export class JourneyController {
  constructor(private readonly journey: JourneyService) {}

  @ApiOperation({ summary: "A member's spiritual journey: milestones, course enrollments and leadership assessments" })
  @ApiOkResponse({ type: MemberJourneyResponseDto })
  @ApiNotFoundResponse({ description: MEMBER_NOT_FOUND })
  @RequirePermission("journey", "read")
  @Get("members/:id/journey")
  get(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<MemberJourneyResponse> {
    return this.journey.getJourney(auth, id)
  }

  @ApiOperation({ summary: "Record a milestone; a baptism milestone also marks the member as baptized" })
  @ApiCreatedResponse({ type: MilestoneResponseDto })
  @ApiNotFoundResponse({ description: MEMBER_NOT_FOUND })
  @RequirePermission("journey", "create")
  @Post("members/:id/milestones")
  addMilestone(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: MilestoneCreateDto,
  ): Promise<MilestoneResponse> {
    return this.journey.addMilestone(auth, id, dto)
  }

  @ApiOperation({ summary: "Delete a milestone; removing the last baptism milestone reverts the member's baptism status" })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: "Milestone not found or its member is outside the caller's tag scope" })
  @RequirePermission("journey", "delete")
  @HttpCode(204)
  @Delete("milestones/:id")
  removeMilestone(@CurrentAuth() auth: AuthContext, @Param("id", ParseUUIDPipe) id: string): Promise<void> {
    return this.journey.removeMilestone(auth, id)
  }

  @ApiOperation({ summary: "Enroll a member in a course (also logs a joined_class milestone)" })
  @ApiCreatedResponse({ type: EnrollmentResponseDto })
  @ApiNotFoundResponse({ description: "Member (or its tag scope) or course not found" })
  @ApiConflictResponse({ description: "Member is already enrolled in this course" })
  @RequirePermission("journey", "create")
  @Post("members/:id/enrollments")
  enroll(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: EnrollmentCreateDto,
  ): Promise<EnrollmentResponse> {
    return this.journey.addEnrollment(auth, id, dto)
  }

  @ApiOperation({ summary: "Set an enrollment's status; completing stamps the completion date" })
  @ApiOkResponse({ type: EnrollmentResponseDto })
  @ApiNotFoundResponse({ description: "Enrollment not found or its member is outside the caller's tag scope" })
  @RequirePermission("journey", "update")
  @Patch("enrollments/:id")
  updateEnrollment(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: EnrollmentUpdateDto,
  ): Promise<EnrollmentResponse> {
    return this.journey.updateEnrollment(auth, id, dto)
  }

  @ApiOperation({ summary: "Record a leadership-potential assessment (appends; the newest is current)" })
  @ApiCreatedResponse({ type: LeadershipAssessmentResponseDto })
  @ApiNotFoundResponse({ description: MEMBER_NOT_FOUND })
  @RequirePermission("journey", "create")
  @Post("members/:id/leadership-assessments")
  assess(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: LeadershipAssessmentCreateDto,
  ): Promise<LeadershipAssessmentResponse> {
    return this.journey.addAssessment(auth, id, dto)
  }

  @ApiOperation({ summary: "Members currently at a pipeline stage, within the caller's tag scope" })
  @ApiQuery({
    name: "stage",
    required: true,
    enum: ["newcomer_followup", "baptism_ready", "sidi_ready", "leader_candidate"],
  })
  @ApiQuery({
    name: "followUpDays",
    required: false,
    description: "Newcomer follow-up threshold in days since joining (default 30)",
  })
  @ApiOkResponse({ type: [PipelineRowResponseDto] })
  @RequirePermission("journey", "read")
  @Get("journey/pipeline")
  pipeline(@CurrentAuth() auth: AuthContext, @Query() query: PipelineQueryDto): Promise<PipelineRowResponse[]> {
    return this.journey.pipeline(auth, query)
  }
}
