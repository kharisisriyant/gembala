import { Injectable } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { JwtService } from "@nestjs/jwt"
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"

export type GoogleOAuthPurpose = "signin" | "calendar"
export type GoogleProfile = { sub: string; email: string; emailVerified: boolean; name: string }
export type GoogleTokens = { profile: GoogleProfile; accessToken: string; refreshToken: string | null; scopes: string[] }

export const GOOGLE_STATE_COOKIE = "gembala-oauth-state"
export const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.app.created"

const STATE_AUDIENCE = "gembala-google-oauth"
const STATE_TTL_SECONDS = 600
const CALLBACK_PATH: Record<GoogleOAuthPurpose, string> = {
  signin: "/auth/google/callback",
  calendar: "/google-calendar/callback",
}
const SCOPES: Record<GoogleOAuthPurpose, string[]> = {
  signin: ["openid", "email", "profile"],
  calendar: ["openid", "email", CALENDAR_SCOPE],
}

// The stored refresh token no longer works (user revoked access, or it expired).
export class GoogleAuthRevokedError extends Error {}

// Google's OAuth endpoints for both features: sign-in and the org calendar
// connection. Holds no state and touches no tables.
@Injectable()
export class GoogleOAuthService {
  constructor(private readonly config: ConfigService, private readonly jwt: JwtService) {}

  get configured(): boolean {
    return Boolean(this.config.get<string>("GOOGLE_CLIENT_ID"))
  }

  private redirectUri(purpose: GoogleOAuthPurpose): string {
    return `${this.config.getOrThrow<string>("API_PUBLIC_URL").replace(/\/$/, "")}${CALLBACK_PATH[purpose]}`
  }

  // `state` is a signed, short-lived JWT carrying `claims`. The caller also sets
  // it as an HttpOnly cookie, so the callback only accepts a flow that this
  // browser started (blocks login CSRF) with claims this server issued.
  async authUrl<C extends Record<string, unknown>>(purpose: GoogleOAuthPurpose, claims: C): Promise<{ url: string; state: string }> {
    const state = await this.jwt.signAsync(
      { ...claims, purpose, nonce: randomBytes(16).toString("hex") },
      { audience: STATE_AUDIENCE, expiresIn: STATE_TTL_SECONDS },
    )
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth")
    url.searchParams.set("client_id", this.config.getOrThrow<string>("GOOGLE_CLIENT_ID"))
    url.searchParams.set("redirect_uri", this.redirectUri(purpose))
    url.searchParams.set("response_type", "code")
    url.searchParams.set("scope", SCOPES[purpose].join(" "))
    url.searchParams.set("state", state)
    if (purpose === "calendar") {
      // offline + consent: Google only returns a refresh token on a fresh consent.
      url.searchParams.set("access_type", "offline")
      url.searchParams.set("prompt", "consent")
    } else {
      url.searchParams.set("prompt", "select_account")
    }
    return { url: url.toString(), state }
  }

  async verifyState<C>(purpose: GoogleOAuthPurpose, state: string | undefined, cookieState: string | undefined): Promise<C> {
    if (!state || state !== cookieState) throw new Error("oauth state does not match this browser")
    const claims = await this.jwt.verifyAsync<C & { purpose: string }>(state, { audience: STATE_AUDIENCE })
    if (claims.purpose !== purpose) throw new Error("oauth state issued for another flow")
    return claims
  }

  async exchangeCode(purpose: GoogleOAuthPurpose, code: string): Promise<GoogleTokens> {
    const data = await this.token({ grant_type: "authorization_code", code, redirect_uri: this.redirectUri(purpose) })
    // The ID token came straight from Google over TLS, so its signature needs no
    // separate check; the audience is still verified.
    const claims = JSON.parse(Buffer.from(String(data.id_token).split(".")[1] ?? "", "base64url").toString("utf8"))
    if (claims.aud !== this.config.getOrThrow<string>("GOOGLE_CLIENT_ID") || !claims.sub || !claims.email) {
      throw new Error("unexpected Google ID token")
    }
    return {
      profile: {
        sub: String(claims.sub),
        email: String(claims.email).toLowerCase(),
        emailVerified: claims.email_verified === true || claims.email_verified === "true",
        name: typeof claims.name === "string" && claims.name.trim() ? claims.name.trim() : String(claims.email).split("@")[0],
      },
      accessToken: String(data.access_token),
      refreshToken: typeof data.refresh_token === "string" ? data.refresh_token : null,
      scopes: String(data.scope ?? "").split(" "),
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresAt: number }> {
    const data = await this.token({ grant_type: "refresh_token", refresh_token: refreshToken })
    return { accessToken: String(data.access_token), expiresAt: Date.now() + Number(data.expires_in ?? 3600) * 1000 }
  }

  // Best effort: the connection is removed locally whether or not Google answers.
  async revoke(token: string): Promise<void> {
    await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
    }).catch(() => undefined)
  }

  private async token(params: Record<string, string>): Promise<Record<string, unknown>> {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        ...params,
        client_id: this.config.getOrThrow<string>("GOOGLE_CLIENT_ID"),
        client_secret: this.config.getOrThrow<string>("GOOGLE_CLIENT_SECRET"),
      }),
    })
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (!res.ok) {
      if (data.error === "invalid_grant" && params.grant_type === "refresh_token") throw new GoogleAuthRevokedError("Google access was revoked")
      throw new Error(`Google token endpoint returned ${res.status}: ${String(data.error ?? "unknown error")}`)
    }
    return data
  }

  // AES-256-GCM for refresh tokens at rest; stored as iv.tag.ciphertext (base64url).
  private key(): Buffer {
    return createHash("sha256").update(this.config.getOrThrow<string>("GOOGLE_TOKEN_ENCRYPTION_KEY")).digest()
  }

  encrypt(plain: string): string {
    const iv = randomBytes(12)
    const cipher = createCipheriv("aes-256-gcm", this.key(), iv)
    const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
    return [iv, cipher.getAuthTag(), data].map((part) => part.toString("base64url")).join(".")
  }

  decrypt(stored: string): string {
    const [iv, tag, data] = stored.split(".").map((part) => Buffer.from(part, "base64url"))
    const decipher = createDecipheriv("aes-256-gcm", this.key(), iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8")
  }
}
