import { Injectable } from "@nestjs/common"

export class GoogleApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
  }
}

export type GoogleEventBody = {
  summary: string
  description: string
  location?: string
  start: { dateTime: string }
  end: { dateTime: string }
}

const BASE = "https://www.googleapis.com/calendar/v3"
const gone = (status: number) => status === 404 || status === 410

// Thin HTTP wrapper over the Google Calendar v3 REST API. No business rules.
@Injectable()
export class GoogleCalendarClient {
  private async call(token: string, method: string, path: string, body?: unknown): Promise<any> {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
      throw new GoogleApiError(res.status, data.error?.message ?? `Google Calendar returned ${res.status}`)
    }
    return res.status === 204 ? undefined : res.json()
  }

  async createCalendar(token: string, summary: string, timeZone: string): Promise<string> {
    const data = await this.call(token, "POST", "/calendars", { summary, timeZone })
    return data.id as string
  }

  async deleteCalendar(token: string, calendarId: string): Promise<void> {
    await this.call(token, "DELETE", `/calendars/${encodeURIComponent(calendarId)}`).catch((err) => {
      if (!(err instanceof GoogleApiError && gone(err.status))) throw err
    })
  }

  // Event ids are chosen by us (see googleEventId), so writes are idempotent:
  // update first, insert when Google has never seen the id. `status` revives an
  // event that was deleted earlier under the same id.
  async upsertEvent(token: string, calendarId: string, id: string, body: GoogleEventBody, insertFirst = false): Promise<void> {
    const base = `/calendars/${encodeURIComponent(calendarId)}/events`
    const payload = { ...body, status: "confirmed" }
    const insert = () => this.call(token, "POST", base, { ...payload, id })
    const update = () => this.call(token, "PUT", `${base}/${id}`, payload)
    try {
      await (insertFirst ? insert() : update())
    } catch (err) {
      if (!(err instanceof GoogleApiError)) throw err
      if (insertFirst && err.status === 409) await update()
      else if (!insertFirst && err.status === 404) await insert()
      else throw err
    }
  }

  async deleteEvent(token: string, calendarId: string, id: string): Promise<void> {
    await this.call(token, "DELETE", `/calendars/${encodeURIComponent(calendarId)}/events/${id}`).catch((err) => {
      if (!(err instanceof GoogleApiError && gone(err.status))) throw err
    })
  }

  // Ids of live events starting from `timeMin`. A 404 means the calendar itself is gone.
  async listEventIds(token: string, calendarId: string, timeMin: Date): Promise<string[]> {
    const ids: string[] = []
    let pageToken: string | undefined
    do {
      const query = new URLSearchParams({ timeMin: timeMin.toISOString(), maxResults: "2500", fields: "items(id),nextPageToken" })
      if (pageToken) query.set("pageToken", pageToken)
      const data = await this.call(token, "GET", `/calendars/${encodeURIComponent(calendarId)}/events?${query}`)
      for (const item of data.items ?? []) ids.push(item.id)
      pageToken = data.nextPageToken
    } while (pageToken)
    return ids
  }
}
