import { Body, Controller, Get, HttpCode, Patch, Post } from "@nestjs/common"
import type { AuthResponse, MeResponse } from "@gembala/shared"
import { CurrentAuth, Public } from "../authz/decorators"
import type { AuthContext } from "../authz/auth-context"
import { AuthService } from "./auth.service"
import {
  AcceptInviteDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
  UpdateProfileDto,
} from "./dto"

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post("register")
  register(@Body() dto: RegisterDto): Promise<AuthResponse> {
    return this.auth.register(dto)
  }

  @Public()
  @HttpCode(200)
  @Post("login")
  login(@Body() dto: LoginDto): Promise<AuthResponse> {
    return this.auth.login(dto)
  }

  @Get("me")
  me(@CurrentAuth() auth: AuthContext): MeResponse {
    return this.auth.meFromContext(auth)
  }

  @Patch("profile")
  updateProfile(@CurrentAuth() auth: AuthContext, @Body() dto: UpdateProfileDto): Promise<MeResponse> {
    return this.auth.updateProfile(auth, dto)
  }

  @HttpCode(204)
  @Post("change-password")
  async changePassword(@CurrentAuth() auth: AuthContext, @Body() dto: ChangePasswordDto): Promise<void> {
    await this.auth.changePassword(auth.userId, dto)
  }

  @Public()
  @HttpCode(204)
  @Post("forgot-password")
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<void> {
    await this.auth.forgotPassword(dto.email)
  }

  @Public()
  @HttpCode(204)
  @Post("reset-password")
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    await this.auth.resetPassword(dto)
  }

  @Public()
  @Post("accept-invite")
  acceptInvite(@Body() dto: AcceptInviteDto): Promise<AuthResponse> {
    return this.auth.acceptInvite(dto)
  }
}
