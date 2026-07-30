import { Controller, Get } from "@nestjs/common"
import type { DashboardResponse } from "@gembala/shared"
import { CurrentAuth } from "../authz/decorators"
import type { AuthContext } from "../authz/auth-context"
import { DashboardService } from "./dashboard.service"

@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  summary(@CurrentAuth() auth: AuthContext): Promise<DashboardResponse> {
    return this.dashboard.summary(auth)
  }
}
