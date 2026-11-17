import { BadGatewayException, BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common"
import { APP_TIME_ZONE, type GoogleCalendarSettingsInput, type GoogleCalendarStatusResponse } from "@gembala/shared"
import type { events, rooms } from "../db/schema"
import { GoogleApiError, GoogleCalendarClient, type GoogleEventBody } from "./google-calendar.client"
import { GoogleCalendarRepository, type GoogleCalendarConnection } from "./google-calendar.repository"
import { CALENDAR_SCOPE, GoogleAuthRevokedError, GoogleOAuthService } from "./google-oauth.service"

type Feed = "events" | "rooms"
type EventWithRoom = { event: typeof events.$inferSelect; room: typeof rooms.$inferSelect | null }

const FEEDS: Feed[] = ["events", "rooms"]
const CALENDAR_COLUMN = { events: "eventsCalendarId", rooms: "roomsCalendarId" } as const
const CALENDAR_LABEL = { events: "Events", rooms: "Rooms" } as const
// How far back a full sync reaches; older events are left as they are in Google.
const SYNC_WINDOW_MS = 30 * 24 * 60 * 60 * 1000
const REVOKED_MESSAGE = "Google access was revoked. Reconnect Google Calendar."

// Google accepts client-chosen event ids in base32hex; a dashless UUID qualifies.
// A deterministic id makes every write idempotent and needs no mapping table.
export const googleEventId = (eventId: string) => eventId.replace(/-/g, "")
const isOurEventId = (id: string) => /^[0-9a-f]{32}$/.test(id)

// Null when the event does not belong in the feed (the rooms feed only holds events with a room).
function eventBody(feed: Feed, { event, room }: EventWithRoom): GoogleEventBody | null {
  if (feed === "rooms" && !room) return null
  return {
    summary: feed === "rooms" ? `${room!.name}: ${event.title}` : event.title,
    description: event.description,
    ...(room ? { location: room.name } : {}),
    start: { dateTime: event.startAt.toISOString() },
    end: { dateTime: event.endAt.toISOString() },
  }
}

// One-way push of Gembala events into an organization's Google account.
// Gembala is the source of truth; edits made in Google are overwritten.
@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name)
  private readonly accessTokens = new Map<string, { accessToken: string; expiresAt: number }>()

  constructor(
    private readonly repo: GoogleCalendarRepository,
    private readonly oauth: GoogleOAuthService,
    private readonly client: GoogleCalendarClient,
  ) {}

  async status(orgId: string): Promise<GoogleCalendarStatusResponse> {
    const conn = await this.repo.findByOrg(orgId)
    return {
      configured: this.oauth.configured,
      connected: Boolean(conn),
      googleEmail: conn?.googleEmail ?? null,
      syncEvents: Boolean(conn?.eventsCalendarId),
      syncRooms: Boolean(conn?.roomsCalendarId),
      lastError: conn?.lastError ?? null,
      lastSyncedAt: conn?.lastSyncedAt?.toISOString() ?? null,
    }
  }

  async connectUrl(orgId: string, userId: string): Promise<{ url: string; state: string }> {
    if (!this.oauth.configured) throw new BadRequestException("Google is not configured on this server")
    return this.oauth.authUrl("calendar", { orgId, userId })
  }

  async completeConnect(code: string | undefined, state: string | undefined, cookieState: string | undefined): Promise<void> {
    const { orgId, userId } = await this.oauth.verifyState<{ orgId: string; userId: string }>("calendar", state, cookieState)
    if (!code) throw new Error("Google returned no authorization code")
    const tokens = await this.oauth.exchangeCode("calendar", code)
    if (!tokens.refreshToken || !tokens.scopes.includes(CALENDAR_SCOPE)) throw new Error("calendar permission was not granted")

    // Calendars belong to the Google account that created them, so they only
    // carry over when the same account reconnects.
    const existing = await this.repo.findByOrg(orgId)
    const carried = existing?.googleEmail === tokens.profile.email ? existing : undefined
    const conn = await this.repo.upsert({
      orgId,
      connectedBy: userId,
      googleEmail: tokens.profile.email,
      refreshTokenEnc: this.oauth.encrypt(tokens.refreshToken),
      eventsCalendarId: carried?.eventsCalendarId ?? null,
      roomsCalendarId: carried?.roomsCalendarId ?? null,
      lastError: null,
    })
    this.accessTokens.delete(orgId)
    if (conn.eventsCalendarId || conn.roomsCalendarId) this.orgChanged(orgId)
  }

  async updateSettings(orgId: string, input: GoogleCalendarSettingsInput): Promise<GoogleCalendarStatusResponse> {
    let conn = await this.requireConnection(orgId)
    const wanted = { events: input.syncEvents, rooms: input.syncRooms }
    await this.foreground(async () => {
      const token = await this.accessToken(conn)
      for (const feed of FEEDS) {
        const calendarId = conn[CALENDAR_COLUMN[feed]]
        if (wanted[feed] === true && !calendarId) {
          conn = await this.createCalendar(conn, feed, token)
        } else if (wanted[feed] === false && calendarId) {
          await this.client.deleteCalendar(token, calendarId)
          conn = await this.repo.update(orgId, { [CALENDAR_COLUMN[feed]]: null })
        }
      }
    })
    if (conn.eventsCalendarId || conn.roomsCalendarId) this.orgChanged(orgId)
    return this.status(orgId)
  }

  async requestSync(orgId: string): Promise<GoogleCalendarStatusResponse> {
    await this.requireConnection(orgId)
    await this.reconcile(orgId)
    return this.status(orgId)
  }

  // Removes the calendars this app created, then the grant. Google-side cleanup
  // is best effort: the connection is dropped even when Google is unreachable.
  async disconnect(orgId: string): Promise<void> {
    const conn = await this.requireConnection(orgId)
    try {
      const token = await this.accessToken(conn)
      for (const feed of FEEDS) {
        const calendarId = conn[CALENDAR_COLUMN[feed]]
        if (calendarId) await this.client.deleteCalendar(token, calendarId)
      }
    } catch (err) {
      this.logger.warn(`Google cleanup failed while disconnecting org ${orgId}: ${String(err)}`)
    }
    await this.oauth.revoke(this.oauth.decrypt(conn.refreshTokenEnc))
    await this.repo.delete(orgId)
    this.accessTokens.delete(orgId)
  }

  // Fire-and-forget hooks for the modules that own the data. A Google outage
  // must never fail an event or room write; the daily reconcile repairs misses.
  eventChanged(orgId: string, eventId: string): void {
    void this.syncEvent(orgId, eventId).catch((err) => this.logger.warn(`Google Calendar event sync crashed: ${String(err)}`))
  }

  orgChanged(orgId: string): void {
    void this.reconcile(orgId).catch((err) => this.logger.warn(`Google Calendar sync crashed: ${String(err)}`))
  }

  // Pushes one event (created, edited or deleted) to every enabled feed.
  async syncEvent(orgId: string, eventId: string): Promise<void> {
    const conn = await this.repo.findByOrg(orgId)
    if (!conn || (!conn.eventsCalendarId && !conn.roomsCalendarId)) return
    try {
      const row = await this.repo.eventWithRoom(orgId, eventId)
      const token = await this.accessToken(conn)
      for (const feed of FEEDS) {
        const calendarId = conn[CALENDAR_COLUMN[feed]]
        if (!calendarId) continue
        const body = row ? eventBody(feed, row) : null
        if (body) await this.client.upsertEvent(token, calendarId, googleEventId(eventId), body)
        else await this.client.deleteEvent(token, calendarId, googleEventId(eventId))
      }
    } catch (err) {
      await this.recordFailure(orgId, err)
    }
  }

  // Full sync: makes each enabled calendar match Gembala for the sync window,
  // recreating a calendar that was deleted in Google.
  async reconcile(orgId: string): Promise<void> {
    let conn = await this.repo.findByOrg(orgId)
    if (!conn || (!conn.eventsCalendarId && !conn.roomsCalendarId)) return
    try {
      const token = await this.accessToken(conn)
      const cutoff = new Date(Date.now() - SYNC_WINDOW_MS)
      const rows = await this.repo.eventsWithRoomEndingAfter(orgId, cutoff)
      for (const feed of FEEDS) {
        let calendarId = conn[CALENDAR_COLUMN[feed]]
        if (!calendarId) continue
        let remote: Set<string>
        try {
          remote = new Set(await this.client.listEventIds(token, calendarId, cutoff))
        } catch (err) {
          if (!(err instanceof GoogleApiError && err.status === 404)) throw err
          conn = await this.createCalendar(conn, feed, token)
          calendarId = conn[CALENDAR_COLUMN[feed]]!
          remote = new Set()
        }
        for (const row of rows) {
          const body = eventBody(feed, row)
          if (!body) continue
          const id = googleEventId(row.event.id)
          await this.client.upsertEvent(token, calendarId, id, body, !remote.has(id))
          remote.delete(id)
        }
        // Leftovers are events deleted (or moved out of the feed) in Gembala.
        // Anything a person added to the calendar by hand has a Google id and is kept.
        for (const id of remote) if (isOurEventId(id)) await this.client.deleteEvent(token, calendarId, id)
      }
      await this.repo.update(orgId, { lastError: null, lastSyncedAt: new Date() })
    } catch (err) {
      await this.recordFailure(orgId, err)
    }
  }

  // Run nightly by GoogleCalendarScheduler.
  async reconcileAll(): Promise<void> {
    if (!this.oauth.configured) return
    for (const conn of await this.repo.listAll()) await this.reconcile(conn.orgId)
  }

  private async requireConnection(orgId: string): Promise<GoogleCalendarConnection> {
    const conn = await this.repo.findByOrg(orgId)
    if (!conn) throw new NotFoundException("Google Calendar is not connected")
    return conn
  }

  private async createCalendar(conn: GoogleCalendarConnection, feed: Feed, token: string): Promise<GoogleCalendarConnection> {
    const orgName = (await this.repo.orgName(conn.orgId)) ?? "Gembala"
    const calendarId = await this.client.createCalendar(token, `${orgName} · ${CALENDAR_LABEL[feed]}`, APP_TIME_ZONE)
    return this.repo.update(conn.orgId, { [CALENDAR_COLUMN[feed]]: calendarId })
  }

  private async accessToken(conn: GoogleCalendarConnection): Promise<string> {
    const cached = this.accessTokens.get(conn.orgId)
    if (cached && cached.expiresAt - 60_000 > Date.now()) return cached.accessToken
    const fresh = await this.oauth.refreshAccessToken(this.oauth.decrypt(conn.refreshTokenEnc))
    this.accessTokens.set(conn.orgId, fresh)
    return fresh.accessToken
  }

  // For requests an admin is waiting on: surface Google failures as HTTP errors.
  private async foreground(work: () => Promise<void>): Promise<void> {
    try {
      await work()
    } catch (err) {
      if (err instanceof GoogleAuthRevokedError) throw new ConflictException(REVOKED_MESSAGE)
      if (err instanceof GoogleApiError) throw new BadGatewayException(`Google Calendar: ${err.message}`)
      throw err
    }
  }

  private async recordFailure(orgId: string, err: unknown): Promise<void> {
    const message = err instanceof GoogleAuthRevokedError ? REVOKED_MESSAGE : err instanceof Error ? err.message : String(err)
    this.logger.warn(`Google Calendar sync failed for org ${orgId}: ${message}`)
    await this.repo.update(orgId, { lastError: message }).catch(() => undefined)
  }
}
