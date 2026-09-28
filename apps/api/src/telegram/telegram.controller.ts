import { Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Post } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import type { TelegramLinkStatusResponse } from "@gembala/shared"
import { ApiBody, ApiNoContentResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger"
import { CurrentAuth, Public } from "../authz/decorators"
import type { AuthContext } from "../authz/auth-context"
import { TelegramService, type TelegramUpdate } from "./telegram.service"

@ApiTags("Telegram")
@Controller("telegram")
export class TelegramController {
  constructor(
    private readonly telegram: TelegramService,
    private readonly config: ConfigService,
  ) {}

  @ApiOperation({ summary: "Get the Telegram link status, or a one-time code to link an account" })
  @ApiOkResponse({
    description: "Linked, or a one-time code to send to the bot",
    schema: {
      oneOf: [
        {
          type: "object",
          required: ["linked", "telegramUsername"],
          properties: {
            linked: { type: "boolean", enum: [true] },
            telegramUsername: { type: "string", nullable: true },
          },
        },
        {
          type: "object",
          required: ["linked", "code", "expiresAt", "botConfigured", "botUsername"],
          properties: {
            linked: { type: "boolean", enum: [false] },
            code: { type: "string", description: "One-time code to send to the bot as /link <code>" },
            expiresAt: { type: "string", format: "date-time" },
            botConfigured: { type: "boolean" },
            botUsername: { type: "string", nullable: true },
          },
        },
      ],
    },
  })
  @Get("link")
  status(@CurrentAuth() auth: AuthContext): Promise<TelegramLinkStatusResponse> {
    return this.telegram.getStatus(auth)
  }

  @ApiOperation({ summary: "Unlink the caller's Telegram account" })
  @ApiNoContentResponse({ description: "Unlinked" })
  @HttpCode(204)
  @Delete("link")
  async unlink(@CurrentAuth() auth: AuthContext): Promise<void> {
    await this.telegram.revoke(auth)
  }

  @ApiOperation({ summary: "Telegram bot webhook (called by Telegram, not by API clients)" })
  @ApiBody({ description: "Telegram Update object (https://core.telegram.org/bots/api#update)", schema: { type: "object", additionalProperties: true } })
  @ApiOkResponse({ schema: { type: "object", properties: { ok: { type: "boolean", example: true } } } })
  @ApiNotFoundResponse({ description: "Webhook secret does not match" })
  @Public()
  @HttpCode(200)
  @Post("webhook/:secret")
  async webhook(@Param("secret") secret: string, @Body() update: TelegramUpdate): Promise<{ ok: true }> {
    const expected = this.config.get<string>("TELEGRAM_WEBHOOK_SECRET")
    if (!expected || secret !== expected) {
      throw new NotFoundException()
    }
    // Fire-and-forget: respond 200 immediately so Telegram doesn't retry the
    // webhook while the AI is still processing (which causes duplicate replies).
    this.telegram.handleUpdate(update).catch((err: unknown) => {
      console.error("Telegram handleUpdate error:", err)
    })
    return { ok: true }
  }
}
