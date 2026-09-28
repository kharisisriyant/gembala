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
} from "@nestjs/common"
import { createZodDto } from "nestjs-zod"
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger"
import { courseCreateSchema, courseUpdateSchema, type CourseResponse } from "@gembala/shared"
import { CourseResponseDto } from "../swagger/response-dtos"
import { CurrentAuth, RequirePermission } from "../authz/decorators"
import type { AuthContext } from "../authz/auth-context"
import { CoursesService } from "./courses.service"

class CourseCreateDto extends createZodDto(courseCreateSchema) {}
class CourseUpdateDto extends createZodDto(courseUpdateSchema) {}

@ApiTags("Courses")
@Controller("courses")
export class CoursesController {
  constructor(private readonly courses: CoursesService) {}

  @ApiOperation({ summary: "List the church's discipleship course catalog with enrollment counts" })
  @ApiOkResponse({ type: [CourseResponseDto] })
  @RequirePermission("courses", "read")
  @Get()
  list(@CurrentAuth() auth: AuthContext): Promise<CourseResponse[]> {
    return this.courses.list(auth)
  }

  @ApiOperation({ summary: "Add a course to the catalog" })
  @ApiCreatedResponse({ type: CourseResponseDto })
  @ApiConflictResponse({ description: "A course with this name already exists" })
  @RequirePermission("courses", "create")
  @Post()
  create(@CurrentAuth() auth: AuthContext, @Body() dto: CourseCreateDto): Promise<CourseResponse> {
    return this.courses.create(auth, dto)
  }

  @ApiOperation({ summary: "Rename a course or change its kind" })
  @ApiOkResponse({ type: CourseResponseDto })
  @ApiNotFoundResponse({ description: "Course not found" })
  @ApiConflictResponse({ description: "A course with this name already exists" })
  @RequirePermission("courses", "update")
  @Patch(":id")
  update(
    @CurrentAuth() auth: AuthContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CourseUpdateDto,
  ): Promise<CourseResponse> {
    return this.courses.update(auth, id, dto)
  }

  @ApiOperation({ summary: "Delete a course that has no enrollments" })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: "Course not found" })
  @ApiConflictResponse({ description: "Course has enrollments" })
  @RequirePermission("courses", "delete")
  @HttpCode(204)
  @Delete(":id")
  remove(@CurrentAuth() auth: AuthContext, @Param("id", ParseUUIDPipe) id: string): Promise<void> {
    return this.courses.remove(auth, id)
  }
}
