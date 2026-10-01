import { z } from "zod"

export const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  PLATFORM_ADMIN_EMAILS: z.string().default(""),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  JWT_SIGNING_KEYS: z.string().min(1),
  JWT_ACTIVE_KID: z.string().min(1).default("default"),
  JWT_ISSUER: z.string().min(1).default("gembala-api"),
  JWT_AUDIENCE: z.string().min(1).default("gembala-web"),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL_SECONDS: z.coerce.number().int().positive().default(2592000),
  AUTH_REFRESH_RATE_LIMIT: z.coerce.number().int().positive().default(30),
  AUTH_LOGIN_RATE_LIMIT: z.coerce.number().int().positive().default(5),
  AUTH_PASSWORD_RATE_LIMIT: z.coerce.number().int().positive().default(5),
  PORT: z.coerce.number().default(3000),
  WEB_ORIGIN: z.string().url().default("http://localhost:5173"),
  RESEND_API_KEY: z.string().startsWith("re_").optional(),
  RESEND_FROM_EMAIL: z.string().email().default("onboarding@resend.dev"),
  RESEND_FROM_NAME: z.string().min(1).default("Gembala"),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_BOT_USERNAME: z.string().optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional(),
  TELEGRAM_WEBHOOK_URL: z.string().url().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().optional(),
})

export type Env = z.infer<typeof envSchema>

export function validateEnv(config: Record<string, unknown>): Env {
  // Keep local deployments running through one configuration migration; new
  // deployments must use JWT_SIGNING_KEYS so keys can be rotated with `kid`.
  const legacySecret = typeof config.JWT_SECRET === "string" ? config.JWT_SECRET : undefined
  const parsed = envSchema.parse({ ...config, JWT_SIGNING_KEYS: config.JWT_SIGNING_KEYS ?? (legacySecret ? `default:${legacySecret}` : undefined) })
  const keys = new Map(parsed.JWT_SIGNING_KEYS.split(",").map((entry) => {
    const separator = entry.indexOf(":")
    return [entry.slice(0, separator).trim(), entry.slice(separator + 1).trim()]
  }))
  if (!keys.get(parsed.JWT_ACTIVE_KID) || [...keys.values()].some((secret) => secret.length < 32)) {
    throw new Error("JWT_SIGNING_KEYS must contain the active key and each secret must be at least 32 characters")
  }
  return parsed
}
