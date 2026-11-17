import { Body, Controller, Get, Put } from "@nestjs/common"
import { createZodDto } from "nestjs-zod"
import { ApiBadRequestResponse, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger"
import { notificationPreferenceUpdateSchema, type NotificationPreferencesResponse } from "@gembala/shared"
import { CurrentAuth } from "../authz/decorators"
import type { AuthContext } from "../authz/auth-context"
import { NotificationPreferencesResponseDto } from "../swagger/response-dtos"
import { PreferencesService } from "./preferences.service"

class PreferenceUpdateDto extends createZodDto(notificationPreferenceUpdateSchema) {}

// Acts on the caller's own settings, so any signed-in user may call it.
@ApiTags("Notifications")
@Controller("notification-preferences")
export class PreferencesController {
  constructor(private readonly preferences: PreferencesService) {}

  @ApiOperation({ summary: "My notification preferences: category by channel grid and channel connection state" })
  @ApiOkResponse({ type: NotificationPreferencesResponseDto })
  @Get()
  get(@CurrentAuth() auth: AuthContext): Promise<NotificationPreferencesResponse> {
    return this.preferences.get(auth.userId)
  }

  @ApiOperation({ summary: "Turn one category on or off for one channel" })
  @ApiOkResponse({ type: NotificationPreferencesResponseDto })
  @ApiBadRequestResponse({ description: "The setting is locked (e.g. in-app, security email)" })
  @Put()
  update(@CurrentAuth() auth: AuthContext, @Body() dto: PreferenceUpdateDto): Promise<NotificationPreferencesResponse> {
    return this.preferences.update(auth.userId, dto)
  }
}
