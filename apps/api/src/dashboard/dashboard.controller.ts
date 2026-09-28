import { Controller, Get } from "@nestjs/common"
import type { DashboardResponse } from "@gembala/shared"
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger"
import { DashboardResponseDto } from "../swagger/response-dtos"
import { CurrentAuth } from "../authz/decorators"
import type { AuthContext } from "../authz/auth-context"
import { DashboardService } from "./dashboard.service"

@ApiTags("Dashboard")
@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @ApiOperation({ summary: "Get dashboard totals, recent sessions, tag histogram and prayer notes" })
  @ApiOkResponse({ type: DashboardResponseDto })
  @Get()
  summary(@CurrentAuth() auth: AuthContext): Promise<DashboardResponse> {
    return this.dashboard.summary(auth)
  }
}
