import { ConflictException, HttpException, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import {
  todayInZone,
  type RosterAssignmentPublicResponse,
  type RosterLinkResponse,
  type RosterNotifyInput,
  type RosterNotifyResponse,
  type RosterRespondInput,
} from "@gembala/shared"
import type { AuthContext } from "../authz/auth-context"
import { InjectDb, type Db } from "../db/drizzle.module"
import { MailService } from "../mail/mail.service"
import { NotificationsService } from "../notifications/notifications.service"
import { renderRosterEmail } from "./roster-email"
import { RosterResponsesRepository } from "./roster-responses.repository"
import { rosterTokenAssignmentId, rosterTokenMatches, signRosterToken } from "./roster-token"

type Context = NonNullable<Awaited<ReturnType<RosterResponsesRepository["findContext"]>>>

// Per client IP, across view and respond. Tokens are 256-bit MACs, so this only
// caps noise and write volume; it is not what keeps links unguessable.
const RATE_LIMIT = 30
const RATE_WINDOW_MS = 60_000

// Answers close when the service day begins in Asia/Jakarta. Schedule events
// carry a date but no start time, so the day boundary is the only safe cut-off.
export function responsesOpen(date: string, now: Date): boolean {
  return todayInZone(now) < date
}

@Injectable()
export class RosterResponsesService {
  constructor(
    private readonly repo: RosterResponsesRepository,
    private readonly config: ConfigService,
    private readonly mail: MailService,
    private readonly notifications: NotificationsService,
    @InjectDb() private readonly db: Db,
  ) {}

  private get secret() {
    return this.config.getOrThrow<string>("NOTIFICATION_LINK_SECRET")
  }

  private url(ctx: Context): string {
    const url = new URL("/roster/respond", this.config.getOrThrow<string>("WEB_ORIGIN"))
    url.searchParams.set("token", signRosterToken(this.secret, ctx.assignment.id, ctx.assignment.linkNonce))
    return url.toString()
  }

  // Leader side: the assignment must be in the caller's org and name a member.
  private async loadForLeader(auth: AuthContext, assignmentId: string): Promise<Context & { member: NonNullable<Context["member"]> }> {
    const ctx = await this.repo.findContext(assignmentId)
    if (!ctx || ctx.event.orgId !== auth.orgId) throw new NotFoundException("role assignment not found")
    if (!ctx.member) throw new ConflictException("only assignments to a member have a confirmation link")
    return ctx as Context & { member: NonNullable<Context["member"]> }
  }

  // Public side: one 404 for malformed, forged, stale (rotated nonce) and deleted links.
  private async loadByToken(token: string): Promise<Context & { member: NonNullable<Context["member"]> }> {
    const id = rosterTokenAssignmentId(token)
    const ctx = id ? await this.repo.findContext(id) : undefined
    if (!ctx || !ctx.member || !rosterTokenMatches(this.secret, token, ctx.assignment.id, ctx.assignment.linkNonce)) {
      throw new NotFoundException("This link is no longer valid")
    }
    return ctx as Context & { member: NonNullable<Context["member"]> }
  }

  private async rateLimit(ip: string | undefined) {
    if (!(await this.repo.consumeRateLimit(`roster:${ip ?? "unknown"}`, RATE_LIMIT, RATE_WINDOW_MS))) {
      throw new HttpException("too many requests", 429)
    }
  }

  private toPublic(ctx: Context & { member: NonNullable<Context["member"]> }, now: Date): RosterAssignmentPublicResponse {
    return {
      churchName: ctx.churchName,
      date: ctx.event.date,
      theme: ctx.event.theme,
      serviceName: ctx.serviceName,
      roleName: ctx.roleName,
      memberName: ctx.member.name,
      status: ctx.assignment.responseStatus,
      respondedAt: ctx.assignment.respondedAt?.toISOString() ?? null,
      declineReason: ctx.assignment.declineReason,
      open: responsesOpen(ctx.event.date, now),
    }
  }

  // Returns the link to share by hand (WhatsApp); the caller becomes the leader
  // who is told about a decline.
  async link(auth: AuthContext, assignmentId: string): Promise<RosterLinkResponse> {
    const ctx = await this.loadForLeader(auth, assignmentId)
    await this.repo.update(ctx.assignment.id, { requestedByUserId: auth.userId })
    return { url: this.url(ctx) }
  }

  // Emails the link when the member has an address; otherwise returns it so the
  // leader can share it another way.
  async notify(auth: AuthContext, assignmentId: string, input: RosterNotifyInput, now = new Date()): Promise<RosterNotifyResponse> {
    const ctx = await this.loadForLeader(auth, assignmentId)
    if (!responsesOpen(ctx.event.date, now)) throw new ConflictException("this service has already started")
    const url = this.url(ctx)
    const email = ctx.member.email.trim()
    if (!email) {
      await this.repo.update(ctx.assignment.id, { requestedByUserId: auth.userId })
      return { sentTo: null, url, notifiedAt: ctx.assignment.notifiedAt?.toISOString() ?? null }
    }
    try {
      await this.mail.sendNotification(
        email,
        renderRosterEmail({
          locale: input.locale,
          churchName: ctx.churchName,
          memberName: ctx.member.name,
          roleName: ctx.roleName,
          serviceName: ctx.serviceName,
          date: ctx.event.date,
          url,
        }),
      )
    } catch {
      throw new ServiceUnavailableException("the email could not be sent")
    }
    await this.repo.update(ctx.assignment.id, { requestedByUserId: auth.userId, notifiedAt: now })
    return { sentTo: "email", url, notifiedAt: now.toISOString() }
  }

  async view(token: string, ip: string | undefined, now = new Date()): Promise<RosterAssignmentPublicResponse> {
    await this.rateLimit(ip)
    return this.toPublic(await this.loadByToken(token), now)
  }

  // The member may change their answer until the service day begins. A switch to
  // "declined" tells the leader who shared the link, in the same transaction.
  async respond(token: string, input: RosterRespondInput, ip: string | undefined, now = new Date()): Promise<RosterAssignmentPublicResponse> {
    await this.rateLimit(ip)
    const ctx = await this.loadByToken(token)
    if (!responsesOpen(ctx.event.date, now)) throw new ConflictException("responses for this service are closed")

    const declineReason = input.status === "declined" ? (input.reason ?? "") : ""
    const newlyDeclined = input.status === "declined" && ctx.assignment.responseStatus !== "declined"
    const leaderId = ctx.assignment.requestedByUserId

    const row = await this.db.transaction(async (tx) => {
      const updated = await this.repo.update(ctx.assignment.id, { responseStatus: input.status, respondedAt: now, declineReason }, tx)
      if (newlyDeclined && leaderId) {
        await this.notifications.notify(
          {
            type: "roster.declined",
            orgId: ctx.event.orgId,
            recipients: [leaderId],
            payload: {
              memberName: ctx.member.name,
              roleName: ctx.roleName,
              serviceName: ctx.serviceName,
              date: ctx.event.date,
              reason: declineReason,
            },
            idempotencyKey: `roster_declined:${ctx.assignment.id}:${now.getTime()}`,
          },
          tx,
        )
      }
      return updated
    })
    return this.toPublic({ ...ctx, assignment: row }, now)
  }
}
