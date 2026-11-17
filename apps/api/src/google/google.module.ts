import { Module } from "@nestjs/common"
import { GoogleCalendarClient } from "./google-calendar.client"
import { GoogleCalendarController } from "./google-calendar.controller"
import { GoogleCalendarScheduler } from "./google-calendar.scheduler"
import { GoogleCalendarRepository } from "./google-calendar.repository"
import { GoogleCalendarService } from "./google-calendar.service"
import { GoogleOAuthService } from "./google-oauth.service"

@Module({
  controllers: [GoogleCalendarController],
  providers: [GoogleOAuthService, GoogleCalendarClient, GoogleCalendarRepository, GoogleCalendarService, GoogleCalendarScheduler],
  exports: [GoogleOAuthService, GoogleCalendarService],
})
export class GoogleModule {}
