import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common"
import { createZodDto } from "nestjs-zod"
import { ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger"
import { z } from "zod"
import {
  NOTIFICATION_CATEGORIES,
  type NotificationItemResponse,
  type NotificationListResponse,
  type NotificationReadAllResponse,
  type NotificationUnreadCountResponse,
} from "@gembala/shared"
import { CurrentAuth } from "../authz/decorators"
import type { AuthContext } from "../authz/auth-context"
import {
  NotificationItemResponseDto,
  NotificationListResponseDto,
  NotificationReadAllResponseDto,
  NotificationUnreadCountResponseDto,
} from "../swagger/response-dtos"
import { InboxService } from "./inbox.service"

class InboxListQueryDto extends createZodDto(
  z.object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    unread: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
    category: z.enum(NOTIFICATION_CATEGORIES).optional(),
  }),
) {}

// Every route acts on the caller's own inbox in their current org, so any
// signed-in user may call it and none needs @RequirePermission.
@ApiTags("Notifications")
@Controller("notifications")
export class InboxController {
  constructor(private readonly inbox: InboxService) {}

  @ApiOperation({ summary: "List my notifications in the current org, newest first (cursor-paginated)" })
  @ApiQuery({ name: "cursor", required: false, description: "`nextCursor` from the previous page" })
  @ApiQuery({ name: "limit", required: false, description: "1-50, default 20" })
  @ApiQuery({ name: "unread", required: false, enum: ["true", "false"], description: "Only unread items" })
  @ApiQuery({ name: "category", required: false, enum: NOTIFICATION_CATEGORIES })
  @ApiOkResponse({ type: NotificationListResponseDto })
  @Get()
  list(@CurrentAuth() auth: AuthContext, @Query() query: InboxListQueryDto): Promise<NotificationListResponse> {
    return this.inbox.list(auth, query)
  }

  @ApiOperation({ summary: "Number of unread notifications in the current org" })
  @ApiOkResponse({ type: NotificationUnreadCountResponseDto })
  @Get("unread-count")
  unreadCount(@CurrentAuth() auth: AuthContext): Promise<NotificationUnreadCountResponse> {
    return this.inbox.unreadCount(auth)
  }

  @ApiOperation({ summary: "Mark every unread notification in the current org as read" })
  @ApiOkResponse({ type: NotificationReadAllResponseDto })
  @HttpCode(200)
  @Post("read-all")
  readAll(@CurrentAuth() auth: AuthContext): Promise<NotificationReadAllResponse> {
    return this.inbox.markAllRead(auth)
  }

  @ApiOperation({ summary: "Mark a notification as read" })
  @ApiOkResponse({ type: NotificationItemResponseDto })
  @ApiNotFoundResponse({ description: "Not found, or not the caller's notification" })
  @Patch(":id/read")
  read(@CurrentAuth() auth: AuthContext, @Param("id", ParseUUIDPipe) id: string): Promise<NotificationItemResponse> {
    return this.inbox.setRead(auth, id, true)
  }

  @ApiOperation({ summary: "Mark a notification as unread" })
  @ApiOkResponse({ type: NotificationItemResponseDto })
  @ApiNotFoundResponse({ description: "Not found, or not the caller's notification" })
  @Patch(":id/unread")
  unread(@CurrentAuth() auth: AuthContext, @Param("id", ParseUUIDPipe) id: string): Promise<NotificationItemResponse> {
    return this.inbox.setRead(auth, id, false)
  }
}
