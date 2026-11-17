import { Controller, Get, HttpCode, Post, Query, Req, type RawBodyRequest } from "@nestjs/common"
import { ApiBadRequestResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags, ApiUnauthorizedResponse } from "@nestjs/swagger"
import type { Request } from "express"
import { z } from "zod"
import { createZodDto } from "nestjs-zod"
import type { NotificationUnsubscribePreviewResponse } from "@gembala/shared"
import { Public } from "../authz/decorators"
import { NotificationUnsubscribePreviewResponseDto } from "../swagger/response-dtos"
import { ResendWebhookService } from "./resend-webhook.service"
import { UnsubscribeService } from "./unsubscribe.service"

class TokenQueryDto extends createZodDto(z.object({ token: z.string().min(1) })) {}

@ApiTags("Notifications")
@Controller()
export class EmailController {
  constructor(
    private readonly unsubscribe: UnsubscribeService,
    private readonly webhook: ResendWebhookService,
  ) {}

  @ApiOperation({ summary: "Check an email unsubscribe link and say which category it turns off (no login)" })
  @ApiQuery({ name: "token", description: "Signed token from the email footer" })
  @ApiOkResponse({ type: NotificationUnsubscribePreviewResponseDto })
  @ApiBadRequestResponse({ description: "Invalid or tampered link" })
  @Public()
  @Get("notifications/unsubscribe")
  preview(@Query() query: TokenQueryDto): NotificationUnsubscribePreviewResponse {
    return this.unsubscribe.preview(query.token)
  }

  @ApiOperation({ summary: "Unsubscribe from a category of notification emails; also the one-click target (no login)" })
  @ApiQuery({ name: "token", description: "Signed token from the email footer" })
  @ApiNoContentResponse({ description: "Preference saved" })
  @ApiBadRequestResponse({ description: "Invalid or tampered link" })
  @Public()
  @HttpCode(204)
  @Post("notifications/unsubscribe")
  async apply(@Query() query: TokenQueryDto): Promise<void> {
    await this.unsubscribe.apply(query.token)
  }

  @ApiOperation({ summary: "Resend delivery callbacks (delivered, bounced, complained). Signature verified." })
  @ApiNoContentResponse({ description: "Event processed or ignored" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid signature" })
  @Public()
  @HttpCode(204)
  @Post("webhooks/resend")
  async resend(@Req() req: RawBodyRequest<Request>): Promise<void> {
    await this.webhook.handle(req.rawBody?.toString("utf8") ?? "", req.headers)
  }
}
