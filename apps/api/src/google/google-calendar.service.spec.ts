import { ConflictException, NotFoundException } from "@nestjs/common"
import { GoogleApiError } from "./google-calendar.client"
import { GoogleCalendarService, googleEventId } from "./google-calendar.service"
import { CALENDAR_SCOPE, GoogleAuthRevokedError } from "./google-oauth.service"

const orgId = "org-1"
const eventId = "0b1f6a52-3c4d-4e5f-8a9b-0c1d2e3f4a5b"
const gid = googleEventId(eventId)
const room = { id: "room-1", name: "Main Hall" }
const event = {
  id: eventId,
  orgId,
  roomId: "room-1",
  title: "Sunday Service",
  description: "All welcome",
  startAt: new Date("2026-12-06T02:00:00Z"),
  endAt: new Date("2026-12-06T04:00:00Z"),
  isPublic: false,
}
const connection = (patch: object = {}) => ({
  orgId,
  connectedBy: "u1",
  googleEmail: "church@example.com",
  refreshTokenEnc: "enc",
  eventsCalendarId: "cal-events",
  roomsCalendarId: "cal-rooms",
  lastError: null,
  lastSyncedAt: null,
  ...patch,
})

describe("GoogleCalendarService", () => {
  let repo: Record<string, jest.Mock>
  let oauth: Record<string, any>
  let client: Record<string, jest.Mock>
  let service: GoogleCalendarService

  beforeEach(() => {
    repo = {
      findByOrg: jest.fn().mockResolvedValue(connection()),
      listAll: jest.fn(),
      upsert: jest.fn(async (row) => connection(row)),
      update: jest.fn(async (_org, patch) => connection(patch)),
      delete: jest.fn(),
      orgName: jest.fn().mockResolvedValue("Grace Church"),
      eventWithRoom: jest.fn().mockResolvedValue({ event, room }),
      eventsWithRoomEndingAfter: jest.fn().mockResolvedValue([{ event, room }]),
    }
    oauth = {
      configured: true,
      authUrl: jest.fn(),
      verifyState: jest.fn().mockResolvedValue({ orgId, userId: "u1" }),
      exchangeCode: jest.fn(),
      refreshAccessToken: jest.fn().mockResolvedValue({ accessToken: "at", expiresAt: Date.now() + 3_600_000 }),
      revoke: jest.fn(),
      encrypt: jest.fn((v: string) => `enc(${v})`),
      decrypt: jest.fn().mockReturnValue("rt"),
    }
    client = {
      createCalendar: jest.fn().mockResolvedValue("cal-new"),
      deleteCalendar: jest.fn(),
      upsertEvent: jest.fn(),
      deleteEvent: jest.fn(),
      listEventIds: jest.fn().mockResolvedValue([]),
    }
    service = new GoogleCalendarService(repo as any, oauth as any, client as any)
  })

  describe("syncEvent", () => {
    it("writes the event to both calendars, private events included", async () => {
      await service.syncEvent(orgId, eventId)
      expect(client.upsertEvent).toHaveBeenCalledWith("at", "cal-events", gid, expect.objectContaining({ summary: "Sunday Service", location: "Main Hall" }))
      expect(client.upsertEvent).toHaveBeenCalledWith("at", "cal-rooms", gid, expect.objectContaining({ summary: "Main Hall: Sunday Service" }))
    })

    it("removes an event without a room from the rooms calendar only", async () => {
      repo.eventWithRoom.mockResolvedValue({ event: { ...event, roomId: null }, room: null })
      await service.syncEvent(orgId, eventId)
      expect(client.upsertEvent).toHaveBeenCalledTimes(1)
      expect(client.deleteEvent).toHaveBeenCalledWith("at", "cal-rooms", gid)
    })

    it("deletes a removed event from every calendar", async () => {
      repo.eventWithRoom.mockResolvedValue(undefined)
      await service.syncEvent(orgId, eventId)
      expect(client.deleteEvent).toHaveBeenCalledTimes(2)
      expect(client.upsertEvent).not.toHaveBeenCalled()
    })

    it("only touches feeds that are switched on", async () => {
      repo.findByOrg.mockResolvedValue(connection({ roomsCalendarId: null }))
      await service.syncEvent(orgId, eventId)
      expect(client.upsertEvent).toHaveBeenCalledTimes(1)
      expect(client.upsertEvent).toHaveBeenCalledWith("at", "cal-events", gid, expect.anything())
    })

    it("does nothing, and asks Google for nothing, when the org is not connected", async () => {
      repo.findByOrg.mockResolvedValue(undefined)
      await service.syncEvent(orgId, eventId)
      expect(oauth.refreshAccessToken).not.toHaveBeenCalled()
    })

    it("records a revoked grant instead of throwing", async () => {
      oauth.refreshAccessToken.mockRejectedValue(new GoogleAuthRevokedError("revoked"))
      await expect(service.syncEvent(orgId, eventId)).resolves.toBeUndefined()
      expect(repo.update).toHaveBeenCalledWith(orgId, { lastError: expect.stringContaining("revoked") })
    })
  })

  describe("reconcile", () => {
    beforeEach(() => repo.findByOrg.mockResolvedValue(connection({ roomsCalendarId: null })))

    it("updates known events, inserts new ones and deletes our stale ones", async () => {
      const stale = "a".repeat(32)
      client.listEventIds.mockResolvedValue([stale, "manuallyaddedingoogle12345"])
      await service.reconcile(orgId)
      expect(client.upsertEvent).toHaveBeenCalledWith("at", "cal-events", gid, expect.anything(), true)
      expect(client.deleteEvent).toHaveBeenCalledTimes(1)
      expect(client.deleteEvent).toHaveBeenCalledWith("at", "cal-events", stale)
      expect(repo.update).toHaveBeenCalledWith(orgId, { lastError: null, lastSyncedAt: expect.any(Date) })
    })

    it("updates rather than inserts an event Google already has", async () => {
      client.listEventIds.mockResolvedValue([gid])
      await service.reconcile(orgId)
      expect(client.upsertEvent).toHaveBeenCalledWith("at", "cal-events", gid, expect.anything(), false)
      expect(client.deleteEvent).not.toHaveBeenCalled()
    })

    it("recreates a calendar that was deleted in Google", async () => {
      client.listEventIds.mockRejectedValue(new GoogleApiError(404, "Not Found"))
      repo.update.mockImplementation(async (_org, patch) => connection({ roomsCalendarId: null, ...patch }))
      await service.reconcile(orgId)
      expect(client.createCalendar).toHaveBeenCalledWith("at", "Grace Church · Events", "Asia/Jakarta")
      expect(client.upsertEvent).toHaveBeenCalledWith("at", "cal-new", gid, expect.anything(), true)
    })

    it("records other Google failures and leaves lastSyncedAt alone", async () => {
      client.listEventIds.mockRejectedValue(new GoogleApiError(500, "backend error"))
      await service.reconcile(orgId)
      expect(repo.update).toHaveBeenCalledTimes(1)
      expect(repo.update).toHaveBeenCalledWith(orgId, { lastError: "backend error" })
    })
  })

  describe("updateSettings", () => {
    it("404s when the org is not connected", async () => {
      repo.findByOrg.mockResolvedValue(undefined)
      await expect(service.updateSettings(orgId, { syncEvents: true })).rejects.toThrow(NotFoundException)
    })

    it("creates the calendar when a feed is switched on", async () => {
      repo.findByOrg.mockResolvedValue(connection({ eventsCalendarId: null, roomsCalendarId: null }))
      await service.updateSettings(orgId, { syncRooms: true })
      expect(client.createCalendar).toHaveBeenCalledWith("at", "Grace Church · Rooms", "Asia/Jakarta")
      expect(repo.update).toHaveBeenCalledWith(orgId, { roomsCalendarId: "cal-new" })
    })

    it("deletes the calendar when a feed is switched off, leaving the other feed", async () => {
      await service.updateSettings(orgId, { syncRooms: false })
      expect(client.deleteCalendar).toHaveBeenCalledTimes(1)
      expect(client.deleteCalendar).toHaveBeenCalledWith("at", "cal-rooms")
      expect(repo.update).toHaveBeenCalledWith(orgId, { roomsCalendarId: null })
    })

    it("409s when Google access was revoked", async () => {
      oauth.refreshAccessToken.mockRejectedValue(new GoogleAuthRevokedError("revoked"))
      await expect(service.updateSettings(orgId, { syncEvents: false })).rejects.toThrow(ConflictException)
    })
  })

  describe("completeConnect", () => {
    const tokens = (patch: object = {}) => ({ profile: { email: "church@example.com" }, refreshToken: "rt", scopes: ["openid", CALENDAR_SCOPE], ...patch })

    it("stores the refresh token encrypted, with both feeds off for a first connection", async () => {
      repo.findByOrg.mockResolvedValue(undefined)
      oauth.exchangeCode.mockResolvedValue(tokens())
      await service.completeConnect("code", "state", "state")
      expect(repo.upsert).toHaveBeenCalledWith(expect.objectContaining({ orgId, connectedBy: "u1", refreshTokenEnc: "enc(rt)", eventsCalendarId: null, roomsCalendarId: null }))
    })

    it("keeps the calendars when the same Google account reconnects", async () => {
      oauth.exchangeCode.mockResolvedValue(tokens())
      await service.completeConnect("code", "state", "state")
      expect(repo.upsert).toHaveBeenCalledWith(expect.objectContaining({ eventsCalendarId: "cal-events", roomsCalendarId: "cal-rooms" }))
    })

    it("drops the calendars when a different Google account connects", async () => {
      oauth.exchangeCode.mockResolvedValue(tokens({ profile: { email: "other@example.com" } }))
      await service.completeConnect("code", "state", "state")
      expect(repo.upsert).toHaveBeenCalledWith(expect.objectContaining({ googleEmail: "other@example.com", eventsCalendarId: null, roomsCalendarId: null }))
    })

    it("rejects a consent that did not grant the calendar scope", async () => {
      oauth.exchangeCode.mockResolvedValue(tokens({ scopes: ["openid"] }))
      await expect(service.completeConnect("code", "state", "state")).rejects.toThrow("calendar permission")
      expect(repo.upsert).not.toHaveBeenCalled()
    })

    it("rejects a state that does not verify", async () => {
      oauth.verifyState.mockRejectedValue(new Error("oauth state does not match this browser"))
      await expect(service.completeConnect("code", "state", "other")).rejects.toThrow("state")
      expect(oauth.exchangeCode).not.toHaveBeenCalled()
    })
  })

  describe("disconnect", () => {
    it("deletes both calendars, revokes the grant and removes the connection", async () => {
      await service.disconnect(orgId)
      expect(client.deleteCalendar).toHaveBeenCalledTimes(2)
      expect(oauth.revoke).toHaveBeenCalledWith("rt")
      expect(repo.delete).toHaveBeenCalledWith(orgId)
    })

    it("still removes the connection when Google cleanup fails", async () => {
      oauth.refreshAccessToken.mockRejectedValue(new GoogleAuthRevokedError("revoked"))
      await service.disconnect(orgId)
      expect(repo.delete).toHaveBeenCalledWith(orgId)
    })
  })
})
