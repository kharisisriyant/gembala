import { createHmac, timingSafeEqual } from "node:crypto"
import type { NotificationCategory, NotificationChannel } from "@gembala/shared"

export type LinkClaims = { userId: string; category: NotificationCategory; channel: NotificationChannel; exp?: number }

const b64 = (value: string) => Buffer.from(value).toString("base64url")
const mac = (secret: string, body: string) => createHmac("sha256", secret).update(body).digest("base64url")

// Signed, URL-safe token: `<claims>.<hmac>`. Unsubscribe tokens carry no `exp`
// (the link must keep working in old mail); action links set one (EM-7).
export function signLink(secret: string, claims: LinkClaims): string {
  const body = b64(JSON.stringify(claims))
  return `${body}.${mac(secret, body)}`
}

export function verifyLink(secret: string, token: string, now = Date.now()): LinkClaims | null {
  const [body, sig, ...rest] = token.split(".")
  if (!body || !sig || rest.length > 0) return null
  const expected = Buffer.from(mac(secret, body))
  const given = Buffer.from(sig)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  try {
    const claims = JSON.parse(Buffer.from(body, "base64url").toString()) as LinkClaims
    if (typeof claims.userId !== "string" || !claims.category || !claims.channel) return null
    if (claims.exp !== undefined && claims.exp <= now) return null
    return claims
  } catch {
    return null
  }
}

// Catalog links are app-relative paths; joining them to the configured web
// origin keeps every emitted URL on our own host (SP-4).
export function buildWebLink(origin: string, path: string): string {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) throw new Error(`Invalid app link: ${path}`)
  return `${origin.replace(/\/$/, "")}${path}`
}
