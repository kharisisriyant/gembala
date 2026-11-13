import { Test } from "@nestjs/testing"
import { ConfigModule } from "@nestjs/config"
import type { INestApplication } from "@nestjs/common"
import { and, eq } from "drizzle-orm"
import { z } from "zod"
import { createHmac } from "node:crypto"
import { MailService } from "../src/mail/mail.service"
import { signLink } from "../src/notifications/notifications.links"
import { ResendWebhookService } from "../src/notifications/resend-webhook.service"
import { UnsubscribeService } from "../src/notifications/unsubscribe.service"
import { channelEndpoints, userNotificationPreferences, consentEvents } from "../src/db/schema"
import { validateEnv } from "../src/config/env"
import { DRIZZLE, DrizzleModule, type Db } from "../src/db/drizzle.module"
import { notificationDeliveries, notificationEvents, notifications, orgMemberships, organizations, users } from "../src/db/schema"
import { notificationTypes } from "../src/notifications/notifications.catalog"
import { NotificationsDispatcher } from "../src/notifications/notifications.dispatcher"
import { notificationProviders } from "../src/notifications/notifications.providers"
import { InboxRepository } from "../src/notifications/inbox.repository"
import { InboxService } from "../src/notifications/inbox.service"
import { NotificationsService } from "../src/notifications/notifications.service"
import { resetTestDb, TEST_REDIS_URL } from "./setup-test-db"

notificationTypes.push({
  key: "test.ping",
  category: "activity",
  priority: "normal",
  defaultChannels: [],
  ttlMs: 3_600_000,
  payload: z.object({ n: z.number() }),
  render: (_locale, p) => ({ title: `ping ${p.n}`, body: "body", link: "/x" }),
})

notificationTypes.push({
  key: "test.remind",
  category: "reminder",
  priority: "normal",
  defaultChannels: ["email"],
  ttlMs: 3_600_000,
  payload: z.object({ n: z.number() }),
  render: (_locale, p) => ({ title: `remind ${p.n}`, body: "body", link: "/care" }),
})

const sent: { to: string; subject: string; headers?: Record<string, string> }[] = []
const fakeMail = {
  sendNotification: async (to: string, m: { subject: string; headers?: Record<string, string> }) => {
    sent.push({ to, subject: m.subject, headers: m.headers })
    return { id: `prov-${sent.length}` }
  },
}
const webhookKey = Buffer.from("w".repeat(24))
const webhookSecret = `whsec_${webhookKey.toString("base64")}`
const signedEvent = (event: object) => {
  const body = JSON.stringify(event)
  const id = `msg_${Math.random()}`
  const ts = String(Math.floor(Date.now() / 1000))
  const sig = createHmac("sha256", webhookKey).update(`${id}.${ts}.${body}`).digest("base64")
  return { body, headers: { "svix-id": id, "svix-timestamp": ts, "svix-signature": `v1,${sig}` } }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
async function until<T>(fn: () => Promise<T | undefined | false>, ms = 15_000): Promise<T> {
  const end = Date.now() + ms
  while (Date.now() < end) {
    const v = await fn()
    if (v) return v
    await sleep(100)
  }
  throw new Error("timed out")
}

describe("notification pipeline (real Postgres + Redis)", () => {
  let app: INestApplication
  let db: Db
  let service: NotificationsService
  let dispatcher: NotificationsDispatcher
  let orgId: string
  let alice: string
  let bob: string

  beforeAll(async () => {
    const url = await resetTestDb()
    Object.assign(process.env, {
      DATABASE_URL: url,
      REDIS_URL: TEST_REDIS_URL,
      NOTIFICATIONS_WORKERS: "true",
      RESEND_WEBHOOK_SECRET: webhookSecret,
      JWT_SIGNING_KEYS: "default:" + "x".repeat(40),
    })
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, validate: validateEnv }), DrizzleModule],
      providers: [...notificationProviders, InboxService, InboxRepository, UnsubscribeService, ResendWebhookService, { provide: MailService, useValue: fakeMail }],
    }).compile()
    app = moduleRef.createNestApplication()
    await app.init()
    db = app.get<Db>(DRIZZLE)
    service = app.get(NotificationsService)
    dispatcher = app.get(NotificationsDispatcher)

    ;[{ id: orgId }] = await db.insert(organizations).values({ name: "Church" }).returning()
    const made = await db.insert(users).values([
      { email: "alice@x.test", name: "Alice", passwordHash: "x" },
      { email: "bob@x.test", name: "Bob", passwordHash: "x" },
    ]).returning()
    ;[alice, bob] = made.map((u) => u.id)
    await db.insert(orgMemberships).values([{ orgId, userId: alice }, { orgId, userId: bob }])
  })

  afterAll(() => app.close())

  const ping = (key: string, extra: object = {}) =>
    service.notify({ type: "test.ping", orgId, recipients: [alice, bob], payload: { n: 1 }, idempotencyKey: key, ...extra })

  it("stores one event per idempotency key", async () => {
    expect(await ping("idem-1")).toBe(true)
    expect(await ping("idem-1")).toBe(false)
    const rows = await db.select().from(notificationEvents).where(eq(notificationEvents.idempotencyKey, "idem-1"))
    expect(rows).toHaveLength(1)
  })

  it("delivers in-app end to end through BullMQ, once per user and channel", async () => {
    await ping("e2e-1", { actorUserId: bob }) // bob caused it: only alice is notified
    const delivery = await until(async () => {
      const [row] = await db
        .select({ status: notificationDeliveries.status, attempts: notificationDeliveries.attempts, userId: notifications.userId })
        .from(notificationDeliveries)
        .innerJoin(notifications, eq(notifications.id, notificationDeliveries.notificationId))
        .innerJoin(notificationEvents, eq(notificationEvents.id, notifications.eventId))
        .where(eq(notificationEvents.idempotencyKey, "e2e-1"))
      return row?.status === "sent" ? row : undefined
    })
    expect(delivery).toMatchObject({ userId: alice, attempts: 1 })
  })

  it("claims each event once when relays race", async () => {
    await ping("race-1")
    await Promise.all([service.routePending(), service.routePending(), service.routePending()])
    const rows = await db
      .select({ id: notifications.id })
      .from(notifications)
      .innerJoin(notificationEvents, eq(notificationEvents.id, notifications.eventId))
      .where(eq(notificationEvents.idempotencyKey, "race-1"))
    expect(rows).toHaveLength(2) // alice + bob, no duplicates
    const deliveries = await db
      .select({ id: notificationDeliveries.id })
      .from(notificationDeliveries)
      .innerJoin(notifications, eq(notifications.id, notificationDeliveries.notificationId))
      .innerJoin(notificationEvents, eq(notificationEvents.id, notifications.eventId))
      .where(eq(notificationEvents.idempotencyKey, "race-1"))
    expect(deliveries).toHaveLength(2)
  })

  it("re-enqueues a delivery whose queue job was lost, and sends it once", async () => {
    await ping("lost-1")
    await service.routePending()
    // Simulate Redis losing the job: marked queued long ago, never enqueued.
    const old = new Date(Date.now() - 3_600_000)
    const lost = await db
      .update(notificationDeliveries)
      .set({ status: "queued", updatedAt: old })
      .where(eq(notificationDeliveries.status, "pending"))
      .returning({ id: notificationDeliveries.id })
    expect(lost.length).toBeGreaterThan(0)

    expect(await dispatcher.reconcile()).toBeGreaterThan(0)
    await dispatcher.reconcile() // repeat: job id dedupes
    await until(async () => {
      const rows = await db.select({ status: notificationDeliveries.status, attempts: notificationDeliveries.attempts }).from(notificationDeliveries).where(eq(notificationDeliveries.id, lost[0].id))
      return rows[0]?.status === "sent" ? rows[0] : undefined
    })
    const [after] = await db.select({ attempts: notificationDeliveries.attempts }).from(notificationDeliveries).where(eq(notificationDeliveries.id, lost[0].id))
    expect(after.attempts).toBe(1)
  })

  it("skips a delivery after the kill switch is set at send time", async () => {
    const { notificationKillSwitches } = await import("../src/db/schema")
    await db.insert(notificationKillSwitches).values({ typeKey: "test.ping", reason: "incident" })
    await ping("kill-1")
    const row = await until(async () => {
      const [r] = await db
        .select({ status: notificationDeliveries.status, reason: notificationDeliveries.skipReason })
        .from(notificationDeliveries)
        .innerJoin(notifications, eq(notifications.id, notificationDeliveries.notificationId))
        .innerJoin(notificationEvents, eq(notificationEvents.id, notifications.eventId))
        .where(eq(notificationEvents.idempotencyKey, "kill-1"))
      return r
    })
    expect(row).toMatchObject({ status: "skipped", reason: "kill_switch" })
  })

  it("inbox pages newest first without gaps and keeps read state per user and org", async () => {
    const inbox = app.get(InboxService)
    const [other] = await db.insert(organizations).values({ name: "Other church" }).returning()
    for (let i = 0; i < 5; i++) await ping(`inbox-${i}`)
    await service.routePending()

    const seen: string[] = []
    let cursor: string | undefined
    do {
      const page = await inbox.list({ userId: alice, orgId }, { limit: 2, cursor })
      seen.push(...page.items.map((i) => i.id))
      cursor = page.nextCursor ?? undefined
    } while (cursor)
    const total = await inbox.list({ userId: alice, orgId }, { limit: 50 })
    expect(seen).toEqual(total.items.map((i) => i.id))
    expect(new Set(seen).size).toBe(seen.length)

    // another org sees nothing, and cannot mark alice's item read
    expect((await inbox.list({ userId: alice, orgId: other.id }, { limit: 50 })).items).toHaveLength(0)
    await expect(inbox.setRead({ userId: alice, orgId: other.id }, seen[0], true)).rejects.toThrow()

    const before = (await inbox.unreadCount({ userId: alice, orgId })).count
    expect(before).toBe(seen.length)
    await inbox.setRead({ userId: alice, orgId }, seen[0], true)
    expect((await inbox.unreadCount({ userId: alice, orgId })).count).toBe(before - 1)
    expect((await inbox.list({ userId: alice, orgId }, { limit: 50, unread: true })).items).toHaveLength(before - 1)
    expect((await inbox.markAllRead({ userId: alice, orgId })).updated).toBe(before - 1)
    expect((await inbox.unreadCount({ userId: bob, orgId })).count).toBeGreaterThan(0) // bob untouched
  })

  describe("email channel", () => {
    const remind = (key: string, who = [alice]) =>
      service.notify({ type: "test.remind", orgId, recipients: who, payload: { n: 1 }, idempotencyKey: key })
    const delivery = (key: string, channel: "email" | "inapp" = "email") =>
      until(async () => {
        const [r] = await db
          .select({ id: notificationDeliveries.id, status: notificationDeliveries.status, reason: notificationDeliveries.skipReason, provider: notificationDeliveries.providerMessageId })
          .from(notificationDeliveries)
          .innerJoin(notifications, eq(notifications.id, notificationDeliveries.notificationId))
          .innerJoin(notificationEvents, eq(notificationEvents.id, notifications.eventId))
          .where(and(eq(notificationEvents.idempotencyKey, key), eq(notificationDeliveries.channel, channel)))
        return r && !["pending", "queued"].includes(r.status) ? r : undefined
      })

    it("sends through the queue with unsubscribe headers, then marks delivered on the webhook", async () => {
      await remind("mail-1")
      const d = await delivery("mail-1")
      expect(d.status).toBe("sent")
      expect(d.provider).toMatch(/^prov-/)
      const mail = sent.find((m) => m.to === "alice@x.test" && m.subject === "remind 1")!
      expect(mail.headers?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click")

      const { body, headers } = signedEvent({ type: "email.delivered", created_at: "x", data: { email_id: d.provider, to: ["alice@x.test"] } })
      await app.get(ResendWebhookService).handle(body, headers)
      const [after] = await db.select({ status: notificationDeliveries.status }).from(notificationDeliveries).where(eq(notificationDeliveries.id, d.id))
      expect(after.status).toBe("delivered")
    })

    it("unsubscribe from the link skips later email and logs consent", async () => {
      const token = signLink(process.env.NOTIFICATION_LINK_SECRET!, { userId: bob, category: "reminder", channel: "email" })
      await app.get(UnsubscribeService).apply(token)
      const prefs = await db.select().from(userNotificationPreferences).where(eq(userNotificationPreferences.userId, bob))
      expect(prefs).toMatchObject([{ category: "reminder", channel: "email", enabled: false }])
      const consent = await db.select().from(consentEvents).where(eq(consentEvents.userId, bob))
      expect(consent).toMatchObject([{ source: "email_link", enabled: false }])

      await remind("mail-unsub", [bob])
      expect(await delivery("mail-unsub")).toMatchObject({ status: "skipped", reason: "preference" })
      expect((await delivery("mail-unsub", "inapp")).status).toBe("sent") // inbox still gets it
    })

    it("a permanent bounce suppresses the address for later notifications", async () => {
      await remind("mail-bounce")
      const d = await delivery("mail-bounce")
      const { body, headers } = signedEvent({ type: "email.bounced", created_at: "x", data: { email_id: d.provider, to: ["alice@x.test"], bounce: { type: "Permanent", subType: "General", message: "no such user" } } })
      await app.get(ResendWebhookService).handle(body, headers)
      const [endpoint] = await db.select().from(channelEndpoints).where(eq(channelEndpoints.userId, alice))
      expect(endpoint.status).toBe("bounced")

      const before = sent.length
      await remind("mail-after-bounce")
      expect(await delivery("mail-after-bounce")).toMatchObject({ status: "skipped", reason: "not_connected" })
      expect(sent.length).toBe(before)
    })
  })
})
