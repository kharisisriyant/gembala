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
import { TelegramService } from "../src/telegram/telegram.service"
import { DigestRepository } from "../src/digest/digest.repository"
import { PreferencesService } from "../src/notifications/preferences.service"
import { digestPreferences, userSettings } from "../src/db/schema"
import { sql } from "drizzle-orm"
import { AttentionService } from "../src/attention/attention.service"
import { AuthContextRepository } from "../src/authz/auth-context.repository"
import { AuthContextService } from "../src/authz/auth-context.service"
import { ScopeRepository } from "../src/authz/scope.repository"
import { ScopeService } from "../src/authz/scope.service"
import { RemindersRepository } from "../src/reminders/reminders.repository"
import { RemindersService } from "../src/reminders/reminders.service"
import { careRequests, memberTags, members, membershipScopeTags, tags } from "../src/db/schema"
import { todayInZone } from "@gembala/shared"
import { validateEnv } from "../src/config/env"
import { DRIZZLE, DrizzleModule, type Db } from "../src/db/drizzle.module"
import { notificationDeliveries, notificationEvents, notifications, orgMemberships, organizations, users } from "../src/db/schema"
import { notificationTypes } from "../src/notifications/notifications.catalog"
import { NotificationsDispatcher } from "../src/notifications/notifications.dispatcher"
import { notificationProviders } from "../src/notifications/notifications.providers"
import { NotificationsRepository } from "../src/notifications/notifications.repository"
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

notificationTypes.push({
  key: "test.alert",
  category: "activity",
  priority: "high",
  defaultChannels: ["telegram"],
  ttlMs: 3_600_000,
  payload: z.object({ n: z.number() }),
  render: (_locale, p) => ({ title: `alert ${p.n}`, body: "body", link: "/care" }),
})

const tgSent: { userId: string; text: string; at: number }[] = []
let tgBlocked = false
const fakeTelegram = {
  hasActiveLink: async () => true,
  pushToUser: async (userId: string, m: { text: string }) => {
    if (tgBlocked) return { kind: "permanent", code: "blocked" }
    tgSent.push({ userId, text: m.text, at: Date.now() })
    return { kind: "sent", messageId: `tg-${tgSent.length}` }
  },
}

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
      providers: [...notificationProviders, InboxService, InboxRepository, UnsubscribeService, ResendWebhookService, { provide: MailService, useValue: fakeMail }, { provide: TelegramService, useValue: { ...fakeTelegram, channelState: async () => "connected" } }, PreferencesService, DigestRepository, AuthContextService, AuthContextRepository, ScopeService, ScopeRepository, RemindersService, RemindersRepository, { provide: AttentionService, useValue: {} }],
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

  describe("telegram channel", () => {
    const alert = (key: string) => service.notify({ type: "test.alert", orgId, recipients: [alice], payload: { n: 1 }, idempotencyKey: key })
    const tgDelivery = (key: string) =>
      until(async () => {
        const [r] = await db
          .select({ status: notificationDeliveries.status, error: notificationDeliveries.errorCode, provider: notificationDeliveries.providerMessageId })
          .from(notificationDeliveries)
          .innerJoin(notifications, eq(notifications.id, notificationDeliveries.notificationId))
          .innerJoin(notificationEvents, eq(notificationEvents.id, notifications.eventId))
          .where(and(eq(notificationEvents.idempotencyKey, key), eq(notificationDeliveries.channel, "telegram")))
        return r && !["pending", "queued"].includes(r.status) ? r : undefined
      })

    it("sends once and spaces messages to the same chat at least a second apart", async () => {
      await alert("tg-1")
      await alert("tg-2")
      const [a, b] = await Promise.all([tgDelivery("tg-1"), tgDelivery("tg-2")])
      expect(a.status).toBe("sent")
      expect(b.status).toBe("sent")
      const mine = tgSent.filter((m) => m.text.includes("alert 1")).slice(-2)
      expect(mine).toHaveLength(2)
      expect(Math.abs(mine[1].at - mine[0].at)).toBeGreaterThanOrEqual(900)
    })

    it("marks a blocked bot as a permanent failure and never retries", async () => {
      tgBlocked = true
      await alert("tg-blocked")
      const d = await tgDelivery("tg-blocked")
      tgBlocked = false
      expect(d).toMatchObject({ status: "failed", error: "blocked" })
    })
  })

  describe("preferences and settings", () => {
    it("a settings change reroutes later notifications and is logged as consent", async () => {
      const prefs = app.get(PreferencesService)
      await prefs.update(alice, { category: "activity", channel: "telegram", enabled: false })
      const consent = await db.select().from(consentEvents).where(and(eq(consentEvents.userId, alice), eq(consentEvents.source, "settings")))
      expect(consent).toMatchObject([{ category: "activity", channel: "telegram", enabled: false, actorUserId: alice }])

      await service.notify({ type: "test.alert", orgId, recipients: [alice], payload: { n: 2 }, idempotencyKey: "pref-1" })
      const [row] = await until(async () => {
        const r = await db
          .select({ status: notificationDeliveries.status, reason: notificationDeliveries.skipReason })
          .from(notificationDeliveries)
          .innerJoin(notifications, eq(notifications.id, notificationDeliveries.notificationId))
          .innerJoin(notificationEvents, eq(notificationEvents.id, notifications.eventId))
          .where(and(eq(notificationEvents.idempotencyKey, "pref-1"), eq(notificationDeliveries.channel, "telegram")))
        return r.length ? r : undefined
      })
      expect(row).toMatchObject({ status: "skipped", reason: "preference" })
      const grid = await prefs.get(alice)
      expect(grid.categories.find((c) => c.category === "activity")!.cells.telegram.enabled).toBe(false)
    })

    it("digest locale is stored in user_settings and drives notification language", async () => {
      const digest = app.get(DigestRepository)
      await digest.upsertPreferences(bob, { enabled: true, locale: "en" })
      expect(await digest.findPreferences(bob)).toEqual({ enabled: true, locale: "en" })
      const [settings] = await db.select().from(userSettings).where(eq(userSettings.userId, bob))
      expect(settings).toMatchObject({ locale: "en", timezone: "Asia/Jakarta" })
      expect(await app.get(NotificationsRepository).routingUsers([bob], orgId)).toEqual([{ userId: bob, locale: "en" }])
    })

    it("the migration backfill copies existing digest locales", async () => {
      const [carol] = await db.insert(users).values({ email: "carol@x.test", name: "Carol", passwordHash: "x" }).returning()
      await db.insert(digestPreferences).values({ userId: carol.id, enabled: true, locale: "en" })
      await db.execute(sql`INSERT INTO "user_settings" ("user_id", "locale") SELECT "user_id", "locale" FROM "digest_preferences" ON CONFLICT DO NOTHING`)
      const [row] = await db.select().from(userSettings).where(eq(userSettings.userId, carol.id))
      expect(row.locale).toBe("en")
    })
  })

  describe("care reminders with subject access", () => {
    it("queues due-today reminders and only notifies owners who can still see the member", async () => {
      const [youth, elders] = await db.insert(tags).values([{ orgId, name: "youth" }, { orgId, name: "elders" }]).returning()
      const [jo, eli] = await db.insert(members).values([
        { orgId, name: "Jo", joinedAt: "2026-01-01" },
        { orgId, name: "Eli", joinedAt: "2026-01-01" },
      ]).returning()
      await db.insert(memberTags).values([{ memberId: jo.id, tagId: youth.id }, { memberId: eli.id, tagId: elders.id }])
      const memberships = await db.select().from(orgMemberships).where(eq(orgMemberships.orgId, orgId))
      const of = (userId: string) => memberships.find((m) => m.userId === userId)!.id
      await db.insert(membershipScopeTags).values([{ membershipId: of(alice), tagId: youth.id }, { membershipId: of(bob), tagId: elders.id }])

      const today = todayInZone()
      const base = { orgId, type: "care" as const, body: "x", source: "leader" as const, dueAt: today }
      await db.insert(careRequests).values([
        { ...base, memberId: jo.id, assignedToUserId: alice },  // alice sees Jo
        { ...base, memberId: eli.id, assignedToUserId: alice }, // alice cannot see Eli
        { ...base, memberId: jo.id, assignedToUserId: bob },    // bob cannot see Jo
      ])

      const reminders = app.get(RemindersService)
      expect(await reminders.runCare(today)).toBe(3)
      expect(await reminders.runCare(today)).toBe(0) // rerun: idempotent

      const titles = (userId: string) =>
        db.select({ title: notifications.title }).from(notifications).where(and(eq(notifications.userId, userId), eq(notifications.typeKey, "care_request.due_soon")))
      await until(async () => (await db.select().from(notificationEvents).where(eq(notificationEvents.typeKey, "care_request.due_soon"))).every((e) => e.processedAt) || undefined)
      expect(await titles(alice)).toEqual([{ title: "Tindak lanjut jatuh tempo hari ini: Jo" }])
      expect(await titles(bob)).toEqual([])
    })
  })

  describe("weekly digest through the pipeline", () => {
    it("goes to email only (Telegram is not a digest channel) and is idempotent per week", async () => {
      const payload = { subject: "Your week", text: "Line one\nLine two" }
      const send = () => service.notify({ type: "digest.weekly", orgId, recipients: [bob], payload, idempotencyKey: "digest:bob:2026-11-09" })
      expect(await send()).toBe(true)
      expect(await send()).toBe(false)
      const rows = await until(async () => {
        const r = await db
          .select({ channel: notificationDeliveries.channel, status: notificationDeliveries.status, reason: notificationDeliveries.skipReason })
          .from(notificationDeliveries)
          .innerJoin(notifications, eq(notifications.id, notificationDeliveries.notificationId))
          .innerJoin(notificationEvents, eq(notificationEvents.id, notifications.eventId))
          .where(eq(notificationEvents.idempotencyKey, "digest:bob:2026-11-09"))
        return r.length > 0 && r.every((x) => !["pending", "queued"].includes(x.status)) ? r : undefined
      })
      expect(rows.map((r) => r.channel).sort()).toEqual(["email", "inapp"])
      // bob unsubscribed from reminder emails earlier in this suite, so the digest respects that
      expect(rows.find((r) => r.channel === "email")).toMatchObject({ status: "skipped", reason: "preference" })
    })
  })
})
