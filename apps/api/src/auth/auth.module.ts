import { Module } from "@nestjs/common"
import { NotificationsModule } from "../notifications/notifications.module"
import { AuthController } from "./auth.controller"
import { AuthService } from "./auth.service"
import { AuthRepository } from "./auth.repository"

@Module({
  imports: [NotificationsModule],
  controllers: [AuthController],
  providers: [AuthService, AuthRepository],
  exports: [AuthService],
})
export class AuthModule {}
