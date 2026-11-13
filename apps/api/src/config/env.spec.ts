import { validateEnv } from "./env"

const base = {
  DATABASE_URL: "postgres://u:p@localhost:5432/db",
  JWT_SIGNING_KEYS: `default:${"k".repeat(32)}`,
}

describe("validateEnv: email and link secrets", () => {
  it("refuses production mail from the shared resend.dev domain", () => {
    expect(() =>
      validateEnv({ ...base, NODE_ENV: "production", NOTIFICATION_LINK_SECRET: "s".repeat(32), RESEND_API_KEY: "re_x", RESEND_FROM_EMAIL: "onboarding@resend.dev" }),
    ).toThrow("verified in Resend")
  })

  it("accepts a real sending domain in production", () => {
    expect(() =>
      validateEnv({ ...base, NODE_ENV: "production", NOTIFICATION_LINK_SECRET: "s".repeat(32), RESEND_API_KEY: "re_x", RESEND_FROM_EMAIL: "noreply@gembala.dev" }),
    ).not.toThrow()
  })

  it("still allows the shared domain in development and when mail is console-only", () => {
    expect(() => validateEnv({ ...base, NODE_ENV: "development", RESEND_API_KEY: "re_x", RESEND_FROM_EMAIL: "onboarding@resend.dev" })).not.toThrow()
    expect(() => validateEnv({ ...base, NODE_ENV: "production", NOTIFICATION_LINK_SECRET: "s".repeat(32) })).not.toThrow()
  })

  it("requires a link secret in production and defaults one elsewhere", () => {
    expect(() => validateEnv({ ...base, NODE_ENV: "production" })).toThrow("NOTIFICATION_LINK_SECRET")
    expect(validateEnv({ ...base, NODE_ENV: "development" }).NOTIFICATION_LINK_SECRET).toBeTruthy()
  })

  it("requires Redis when workers are on", () => {
    expect(() => validateEnv({ ...base, NOTIFICATIONS_WORKERS: "true" })).toThrow("REDIS_URL")
  })
})
