import { Body, Controller, Get, HttpCode, Patch, Post } from "@nestjs/common"
import type { AuthResponse, MeResponse } from "@gembala/shared"
import { ApiBadRequestResponse, ApiConflictResponse, ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from "@nestjs/swagger"
import { AuthResponseDto, MeResponseDto } from "../swagger/response-dtos"
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

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @ApiOperation({ summary: "Register a new organization and its first admin user" })
  @ApiCreatedResponse({ type: AuthResponseDto })
  @ApiConflictResponse({ description: "An account with this email already exists" })
  @Public()
  @Post("register")
  register(@Body() dto: RegisterDto): Promise<AuthResponse> {
    return this.auth.register(dto)
  }

  @ApiOperation({ summary: "Log in with email and password" })
  @ApiOkResponse({ type: AuthResponseDto, description: "Bearer token and the caller's profile" })
  @ApiUnauthorizedResponse({ description: "Invalid email or password" })
  @Public()
  @HttpCode(200)
  @Post("login")
  login(@Body() dto: LoginDto): Promise<AuthResponse> {
    return this.auth.login(dto)
  }

  @ApiOperation({ summary: "Get the current user's profile, roles, permissions and tag scope" })
  @ApiOkResponse({ type: MeResponseDto })
  @Get("me")
  me(@CurrentAuth() auth: AuthContext): MeResponse {
    return this.auth.meFromContext(auth)
  }

  @ApiOperation({ summary: "Update the current user's display name" })
  @ApiOkResponse({ type: MeResponseDto })
  @Patch("profile")
  updateProfile(@CurrentAuth() auth: AuthContext, @Body() dto: UpdateProfileDto): Promise<MeResponse> {
    return this.auth.updateProfile(auth, dto)
  }

  @ApiOperation({ summary: "Change the current user's password" })
  @ApiNoContentResponse({ description: "Password changed" })
  @ApiBadRequestResponse({ description: "Current password is incorrect" })
  @HttpCode(204)
  @Post("change-password")
  async changePassword(@CurrentAuth() auth: AuthContext, @Body() dto: ChangePasswordDto): Promise<void> {
    await this.auth.changePassword(auth.userId, dto)
  }

  @ApiOperation({ summary: "Request a password-reset email" })
  @ApiNoContentResponse({ description: "Accepted; responds the same whether or not the email exists" })
  @Public()
  @HttpCode(204)
  @Post("forgot-password")
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<void> {
    await this.auth.forgotPassword(dto.email)
  }

  @ApiOperation({ summary: "Set a new password using a reset token" })
  @ApiNoContentResponse({ description: "Password reset" })
  @ApiUnauthorizedResponse({ description: "Invalid or expired reset link" })
  @Public()
  @HttpCode(204)
  @Post("reset-password")
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    await this.auth.resetPassword(dto)
  }

  @ApiOperation({ summary: "Accept an invite: create the account and join the organization" })
  @ApiCreatedResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ description: "Invalid or expired invite" })
  @ApiConflictResponse({ description: "This email already has an account" })
  @Public()
  @Post("accept-invite")
  acceptInvite(@Body() dto: AcceptInviteDto): Promise<AuthResponse> {
    return this.auth.acceptInvite(dto)
  }
}
