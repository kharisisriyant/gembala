import { Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Post } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import type { TelegramLinkStatusResponse } from "@gembala/shared"
import { CurrentAuth, Public } from "../authz/decorators"
import type { AuthContext } from "../authz/auth-context"
import { TelegramService, type TelegramUpdate } from "./telegram.service"

@Controller("telegram")
export class TelegramController {
  constructor(
    private readonly telegram: TelegramService,
    private readonly config: ConfigService,
  ) {}

  @Get("link")
  status(@CurrentAuth() auth: AuthContext): Promise<TelegramLinkStatusResponse> {
    return this.telegram.getStatus(auth)
  }

  @HttpCode(204)
  @Delete("link")
  async unlink(@CurrentAuth() auth: AuthContext): Promise<void> {
    await this.telegram.revoke(auth)
  }

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
