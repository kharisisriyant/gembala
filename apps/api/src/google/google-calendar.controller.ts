import { Body, Controller, Delete, Get, HttpCode, Patch, Post, Query, Req, Res } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { googleCalendarSettingsSchema, type GoogleCalendarStatusResponse, type GoogleConnectUrlResponse } from "@gembala/shared"
import { ApiBadGatewayResponse, ApiBadRequestResponse, ApiConflictResponse, ApiFoundResponse, ApiNoContentResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger"
import type { Request, Response } from "express"
import { createZodDto } from "nestjs-zod"
import type { AuthContext } from "../authz/auth-context"
import { CurrentAuth, Public, RequireSystemAdmin } from "../authz/decorators"
import { GoogleCalendarStatusResponseDto, GoogleConnectUrlResponseDto } from "../swagger/response-dtos"
import { GoogleCalendarService } from "./google-calendar.service"
import { clearStateCookie, readStateCookie, setStateCookie } from "./state-cookie"

class GoogleCalendarSettingsDto extends createZodDto(googleCalendarSettingsSchema) {}

@ApiTags("Google Calendar")
@Controller("google-calendar")
export class GoogleCalendarController {
  constructor(private readonly calendar: GoogleCalendarService, private readonly config: ConfigService) {}

  @ApiOperation({ summary: "Get the organization's Google Calendar connection and sync settings" })
  @ApiOkResponse({ type: GoogleCalendarStatusResponseDto })
  @RequireSystemAdmin()
  @Get()
  status(@CurrentAuth() auth: AuthContext): Promise<GoogleCalendarStatusResponse> {
    return this.calendar.status(auth.orgId)
  }

  @ApiOperation({ summary: "Start connecting a Google account; returns the Google consent URL" })
  @ApiOkResponse({ type: GoogleConnectUrlResponseDto, description: "Also sets a short-lived HttpOnly state cookie that the callback requires" })
  @ApiBadRequestResponse({ description: "Google is not configured on this server" })
  @RequireSystemAdmin()
  @HttpCode(200)
  @Post("connect")
  async connect(@CurrentAuth() auth: AuthContext, @Res({ passthrough: true }) res: Response): Promise<GoogleConnectUrlResponse> {
    const { url, state } = await this.calendar.connectUrl(auth.orgId, auth.userId)
    setStateCookie(res, state)
    return { url }
  }

  @ApiOperation({ summary: "Google OAuth redirect target: stores the connection, then redirects to the web app" })
  @ApiFoundResponse({ description: "Redirects to /settings/google-calendar?result=connected or ?result=error" })
  @Public()
  @Get("callback")
  async callback(@Query("code") code: string | undefined, @Query("state") state: string | undefined, @Req() req: Request, @Res() res: Response): Promise<void> {
    let result = "connected"
    try {
      await this.calendar.completeConnect(code, state, readStateCookie(req))
    } catch {
      result = "error"
    }
    clearStateCookie(res)
    res.redirect(`${this.config.getOrThrow<string>("WEB_ORIGIN")}/settings/google-calendar?result=${result}`)
  }

  @ApiOperation({ summary: "Switch the events and room-usage calendars on or off" })
  @ApiOkResponse({ type: GoogleCalendarStatusResponseDto, description: "Switching a feed on creates its Google calendar; switching it off deletes that calendar" })
  @ApiNotFoundResponse({ description: "Google Calendar is not connected" })
  @ApiConflictResponse({ description: "Google access was revoked; reconnect" })
  @ApiBadGatewayResponse({ description: "Google Calendar rejected the request" })
  @RequireSystemAdmin()
  @Patch()
  update(@CurrentAuth() auth: AuthContext, @Body() dto: GoogleCalendarSettingsDto): Promise<GoogleCalendarStatusResponse> {
    return this.calendar.updateSettings(auth.orgId, dto)
  }

  @ApiOperation({ summary: "Run a full sync now and return the resulting status" })
  @ApiOkResponse({ type: GoogleCalendarStatusResponseDto, description: "A failed sync is reported in lastError" })
  @ApiNotFoundResponse({ description: "Google Calendar is not connected" })
  @RequireSystemAdmin()
  @HttpCode(200)
  @Post("sync")
  sync(@CurrentAuth() auth: AuthContext): Promise<GoogleCalendarStatusResponse> {
    return this.calendar.requestSync(auth.orgId)
  }

  @ApiOperation({ summary: "Disconnect Google: delete the app-created calendars and revoke access" })
  @ApiNoContentResponse({ description: "Disconnected" })
  @ApiNotFoundResponse({ description: "Google Calendar is not connected" })
  @RequireSystemAdmin()
  @HttpCode(204)
  @Delete()
  disconnect(@CurrentAuth() auth: AuthContext): Promise<void> {
    return this.calendar.disconnect(auth.orgId)
  }
}
