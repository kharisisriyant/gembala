import { Body, Controller, Delete, Get, Headers, HttpCode, Post, UnauthorizedException } from "@nestjs/common"
import { timingSafeEqual } from "node:crypto"
import { ConfigService } from "@nestjs/config"
import type { TelegramLinkStatusResponse } from "@gembala/shared"
import { ApiBody, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from "@nestjs/swagger"
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
          required: ["linked", "disconnected", "code", "expiresAt", "botConfigured", "botUsername"],
          properties: {
            linked: { type: "boolean", enum: [false] },
            disconnected: { type: "boolean", description: "True when the previous link ended because the user blocked the bot" },
            code: { type: "string", description: "One-time code; send it as /link <code> or open t.me/<bot>?start=<code>" },
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
  @ApiUnauthorizedResponse({ description: "Missing or wrong X-Telegram-Bot-Api-Secret-Token header" })
  @Public()
  @HttpCode(200)
  @Post("webhook")
  async webhook(
    @Headers("x-telegram-bot-api-secret-token") secret: string | undefined,
    @Body() update: TelegramUpdate,
  ): Promise<{ ok: true }> {
    const expected = this.config.get<string>("TELEGRAM_WEBHOOK_SECRET")
    const given = Buffer.from(secret ?? "")
    const want = Buffer.from(expected ?? "")
    if (!expected || given.length !== want.length || !timingSafeEqual(given, want)) {
      throw new UnauthorizedException()
    }
    // Fire-and-forget: respond 200 immediately so Telegram doesn't retry the
    // webhook while the AI is still processing (which causes duplicate replies).
    this.telegram.handleUpdate(update).catch((err: unknown) => {
      console.error("Telegram handleUpdate error:", err)
    })
    return { ok: true }
  }
}
