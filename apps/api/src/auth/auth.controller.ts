import { Body, Controller, Get, HttpCode, Patch, Post, Query, Req, Res, UnauthorizedException } from "@nestjs/common"
import { organizationInviteCreateSchema, type OrganizationInviteResponse, type AuthConfigResponse, type AuthResponse, type CsrfResponse, type MeResponse } from "@gembala/shared"
import { ApiBadRequestResponse, ApiConflictResponse, ApiCreatedResponse, ApiForbiddenResponse, ApiFoundResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags, ApiTooManyRequestsResponse, ApiUnauthorizedResponse } from "@nestjs/swagger"
import type { Request, Response } from "express"
import { createZodDto } from "nestjs-zod"
import { OrganizationInviteResponseDto, AuthConfigResponseDto, AuthResponseDto, CsrfResponseDto, MeResponseDto } from "../swagger/response-dtos"
import { CurrentAuth, Public, RequireSystemAdmin } from "../authz/decorators"
import type { AuthContext } from "../authz/auth-context"
import { AuthService, type AuthenticatedSession } from "./auth.service"
import { clearStateCookie, readStateCookie, setStateCookie } from "../google/state-cookie"
import { AcceptInviteDto, ChangePasswordDto, ForgotPasswordDto, LoginDto, RegisterDto, ResetPasswordDto, UpdateProfileDto } from "./dto"

class OrganizationInviteCreateDto extends createZodDto(organizationInviteCreateSchema) {}
type AuthRequest = Request & { auth?: AuthContext; authSessionId?: string }

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  private metadata(req: Request) { return { ipAddress: req.ip, userAgent: req.get("user-agent") } }
  private refreshToken(req: Request) { return req.headers.cookie?.split(";").map((part) => part.trim()).find((part) => part.startsWith("gembala-refresh="))?.slice("gembala-refresh=".length) }
  private cookie(res: Response, value: string) {
    res.cookie("gembala-refresh", value, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: Number(process.env.JWT_REFRESH_TTL_SECONDS ?? 2592000) * 1000 })
  }
  private clearCookie(res: Response) { res.clearCookie("gembala-refresh", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" }) }
  private assertAllowedOrigin(req: Request) {
    const origin = req.get("origin")
    if (origin !== process.env.WEB_ORIGIN) throw new UnauthorizedException("invalid request origin")
  }
  private apply(res: Response, session: AuthenticatedSession): AuthResponse { this.cookie(res, session.refreshToken); res.setHeader("Cache-Control", "no-store"); return session.response }

  @ApiOperation({ summary: "Create a seven-day organization invite link (platform admins only)" })
  @ApiCreatedResponse({ type: OrganizationInviteResponseDto })
  @ApiForbiddenResponse({ description: "Requires an organization admin listed in PLATFORM_ADMIN_EMAILS" })
  @ApiConflictResponse({ description: "An account with this email already exists" })
  @RequireSystemAdmin()
  @Post("organization-invites")
  createOrganizationInvite(@CurrentAuth() auth: AuthContext, @Body() dto: OrganizationInviteCreateDto): Promise<OrganizationInviteResponse> { return this.auth.createOrganizationInvite(auth, dto) }

  @ApiOperation({ summary: "Redeem a single-use organization invite and create its first admin user" })
  @ApiCreatedResponse({ type: AuthResponseDto })
  @Public()
  @Post("register")
  async register(@Body() dto: RegisterDto, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<AuthResponse> { return this.apply(res, await this.auth.register(dto, this.metadata(req))) }

  @ApiOperation({ summary: "Log in with email and password" })
  @ApiOkResponse({ type: AuthResponseDto, description: "Short-lived bearer token and caller profile; refresh session is an HttpOnly cookie" })
  @ApiUnauthorizedResponse({ description: "Invalid email or password" })
  @ApiTooManyRequestsResponse({ description: "Too many authentication attempts" })
  @Public()
  @HttpCode(200)
  @Post("login")
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<AuthResponse> { return this.apply(res, await this.auth.login(dto, this.metadata(req))) }

  @ApiOperation({ summary: "List the sign-in methods this server offers" })
  @ApiOkResponse({ type: AuthConfigResponseDto })
  @Public()
  @Get("config")
  config(): AuthConfigResponse { return this.auth.authConfig() }

  @ApiOperation({ summary: "Start Google sign-in: redirects the browser to Google's consent screen" })
  @ApiFoundResponse({ description: "Redirects to Google, or to /login?google=not_configured. Pass ?invite=<token> to redeem a member invite with the Google account" })
  @Public()
  @Get("google")
  async googleStart(@Query("invite") invite: string | undefined, @Res() res: Response): Promise<void> {
    try {
      const { url, state } = await this.auth.googleStart(invite)
      setStateCookie(res, state)
      res.redirect(url)
    } catch (err) { res.redirect(this.auth.googleRedirectUrl(err)) }
  }

  @ApiOperation({ summary: "Google OAuth redirect target: opens a session, then redirects to the web app" })
  @ApiFoundResponse({ description: "Redirects to /dashboard with the refresh cookie set, or to /login?google=<reason> (failed, unverified, no_account, email_mismatch, invite_invalid)" })
  @Public()
  @Get("google/callback")
  async googleCallback(@Query("code") code: string | undefined, @Query("state") state: string | undefined, @Req() req: Request, @Res() res: Response): Promise<void> {
    clearStateCookie(res)
    try {
      const session = await this.auth.googleSignIn({ code, state, cookieState: readStateCookie(req) }, this.metadata(req))
      this.cookie(res, session.refreshToken)
      res.redirect(this.auth.googleRedirectUrl())
    } catch (err) { res.redirect(this.auth.googleRedirectUrl(err)) }
  }

  @ApiOperation({ summary: "Get a CSRF synchronizer token for a refresh-cookie session" })
  @ApiOkResponse({ type: CsrfResponseDto })
  @ApiUnauthorizedResponse({ description: "No valid refresh session" })
  @Public()
  @Get("csrf")
  async csrf(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<CsrfResponse> { this.assertAllowedOrigin(req); res.setHeader("Cache-Control", "no-store"); return this.auth.csrf(this.refreshToken(req)) }

  @ApiOperation({ summary: "Rotate the refresh cookie and issue a new access token" })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ description: "Invalid refresh session or CSRF token" })
  @ApiTooManyRequestsResponse({ description: "Too many refresh attempts" })
  @Public()
  @HttpCode(200)
  @Post("refresh")
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<AuthResponse> { this.assertAllowedOrigin(req); return this.apply(res, await this.auth.refresh(this.refreshToken(req), req.get("x-csrf-token"), this.metadata(req))) }

  @ApiOperation({ summary: "Revoke the current device session" })
  @ApiNoContentResponse({ description: "Current session revoked" })
  @HttpCode(204)
  @Post("logout")
  async logout(@Req() req: AuthRequest, @Res({ passthrough: true }) res: Response): Promise<void> { if (!req.auth || !req.authSessionId) throw new UnauthorizedException(); await this.auth.logout(req.auth.userId, req.authSessionId, this.metadata(req)); this.clearCookie(res) }

  @ApiOperation({ summary: "Revoke all sessions for the current user" })
  @ApiNoContentResponse({ description: "All sessions revoked" })
  @HttpCode(204)
  @Post("logout-all")
  async logoutAll(@Req() req: AuthRequest, @Res({ passthrough: true }) res: Response): Promise<void> { if (!req.auth) throw new UnauthorizedException(); await this.auth.logoutAll(req.auth.userId, this.metadata(req)); this.clearCookie(res) }

  @ApiOperation({ summary: "Get the current user's profile, roles, permissions and tag scope" })
  @ApiOkResponse({ type: MeResponseDto })
  @Get("me")
  me(@CurrentAuth() auth: AuthContext): MeResponse { return this.auth.meFromContext(auth) }

  @ApiOperation({ summary: "Update the current user's display name" })
  @ApiOkResponse({ type: MeResponseDto })
  @Patch("profile")
  updateProfile(@CurrentAuth() auth: AuthContext, @Body() dto: UpdateProfileDto): Promise<MeResponse> { return this.auth.updateProfile(auth, dto) }

  @ApiOperation({ summary: "Change the current user's password and revoke all sessions" })
  @ApiNoContentResponse({ description: "Password changed and all sessions revoked" })
  @ApiBadRequestResponse({ description: "Current password is incorrect" })
  @HttpCode(204)
  @Post("change-password")
  async changePassword(@CurrentAuth() auth: AuthContext, @Body() dto: ChangePasswordDto, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> { await this.auth.changePassword(auth.userId, dto, this.metadata(req)); this.clearCookie(res) }

  @ApiOperation({ summary: "Request a password-reset email" })
  @ApiNoContentResponse({ description: "Accepted; responds the same whether or not the email exists" })
  @Public()
  @HttpCode(204)
  @Post("forgot-password")
  async forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request): Promise<void> { await this.auth.forgotPassword(dto.email, this.metadata(req)) }

  @ApiOperation({ summary: "Set a new password using a reset token and revoke all sessions" })
  @ApiNoContentResponse({ description: "Password reset" })
  @ApiUnauthorizedResponse({ description: "Invalid or expired reset link" })
  @Public()
  @HttpCode(204)
  @Post("reset-password")
  async resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request): Promise<void> { await this.auth.resetPassword(dto, this.metadata(req)) }

  @ApiOperation({ summary: "Accept an invite: create the account and join the organization" })
  @ApiCreatedResponse({ type: AuthResponseDto })
  @Public()
  @Post("accept-invite")
  async acceptInvite(@Body() dto: AcceptInviteDto, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<AuthResponse> { return this.apply(res, await this.auth.acceptInvite(dto, this.metadata(req))) }
}
