import { Body, Controller, Get, Put } from "@nestjs/common"
import { createZodDto } from "nestjs-zod"
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger"
import { digestPreferencesSchema, type DigestPreferencesResponse, type DigestPreviewResponse } from "@gembala/shared"
import { DigestPreferencesResponseDto, DigestPreviewResponseDto } from "../swagger/response-dtos"
import { CurrentAuth } from "../authz/decorators"
import type { AuthContext } from "../authz/auth-context"
import { DigestService } from "./digest.service"

class DigestPreferencesDto extends createZodDto(digestPreferencesSchema) {}

// Every route acts on the caller's own data, so any signed-in user may call it
// and none needs @RequirePermission.
@ApiTags("Digest")
@Controller("digest")
export class DigestController {
  constructor(private readonly digest: DigestService) {}

  @ApiOperation({ summary: "Get my weekly digest preferences (defaults when never saved)" })
  @ApiOkResponse({ type: DigestPreferencesResponseDto })
  @Get("preferences")
  preferences(@CurrentAuth() auth: AuthContext): Promise<DigestPreferencesResponse> {
    return this.digest.getPreferences(auth.userId)
  }

  @ApiOperation({ summary: "Turn my weekly digest on or off and choose its language" })
  @ApiOkResponse({ type: DigestPreferencesResponseDto })
  @Put("preferences")
  save(@CurrentAuth() auth: AuthContext, @Body() dto: DigestPreferencesDto): Promise<DigestPreferencesResponse> {
    return this.digest.savePreferences(auth.userId, dto)
  }

  @ApiOperation({ summary: "Preview the digest as it would be sent this week (sends nothing)" })
  @ApiOkResponse({ type: DigestPreviewResponseDto })
  @Get("preview")
  preview(@CurrentAuth() auth: AuthContext): Promise<DigestPreviewResponse> {
    return this.digest.preview(auth)
  }
}
