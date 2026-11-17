import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common"
import type { SessionCreateInput, SessionExcused, SessionResponse, SessionUpdateInput } from "@gembala/shared"
import { InjectDb, type Db } from "../db/drizzle.module"
import type { AuthContext } from "../authz/auth-context"
import { GroupsService } from "./groups.service"
import { AttendanceRepository, type AttendanceRowInput, type SessionPatch } from "./attendance.repository"

@Injectable()
export class AttendanceService {
  constructor(
    @InjectDb() private readonly db: Db,
    private readonly attendance: AttendanceRepository,
    private readonly groups: GroupsService,
  ) {}

  async logSession(
    auth: AuthContext,
    groupId: string,
    input: SessionCreateInput,
  ): Promise<SessionResponse> {
    await this.groups.requireVisibleGroup(auth, groupId)

    const excused = input.excused ?? []
    const rows = await this.validateAttendance(groupId, input.presentIds, excused)

    const created = await this.db.transaction(async (tx) => {
      const row = await this.attendance.insertSession(
        {
          orgId: auth.orgId,
          groupId,
          date: input.date,
          topic: input.topic,
          prayerNotes: input.prayerNotes,
        },
        tx,
      )
      await this.attendance.insertAttendance(row.id, rows, tx)
      return row
    })

    return {
      id: created.id,
      groupId,
      date: created.date,
      topic: created.topic,
      prayerNotes: created.prayerNotes,
      presentIds: input.presentIds,
      excused: rows.filter((r) => r.status === "excused").map((r) => ({ memberId: r.memberId, reason: r.reason })),
    }
  }

  // Partial update. Giving presentIds and/or excused replaces the session's
  // whole attendance set; an omitted list keeps its current value.
  async updateSession(
    auth: AuthContext,
    groupId: string,
    sessionId: string,
    input: SessionUpdateInput,
  ): Promise<SessionResponse> {
    await this.requireSession(auth, groupId, sessionId)

    const current = await this.attendance.attendanceRows(sessionId)
    const currentPresent = current.filter((r) => r.status === "present").map((r) => r.memberId)
    const currentExcused = current
      .filter((r) => r.status === "excused")
      .map((r) => ({ memberId: r.memberId, reason: r.reason }))

    const attendanceChanged = input.presentIds !== undefined || input.excused !== undefined
    const presentIds = input.presentIds ?? currentPresent
    const excused = input.excused ?? currentExcused
    // Members who have since left the roster may keep the mark they already had.
    const alreadyRecorded = new Set(current.map((r) => r.memberId))
    const rows = attendanceChanged
      ? await this.validateAttendance(groupId, presentIds, excused, alreadyRecorded)
      : []

    const patch: SessionPatch = {}
    if (input.date !== undefined) patch.date = input.date
    if (input.topic !== undefined) patch.topic = input.topic
    if (input.prayerNotes !== undefined) patch.prayerNotes = input.prayerNotes

    const updated = await this.db.transaction(async (tx) => {
      const row = await this.attendance.updateSession(sessionId, patch, tx)
      if (attendanceChanged) await this.attendance.replaceAttendance(sessionId, rows, tx)
      return row
    })

    return {
      id: updated.id,
      groupId,
      date: updated.date,
      topic: updated.topic,
      prayerNotes: updated.prayerNotes,
      presentIds,
      excused: attendanceChanged
        ? rows.filter((r) => r.status === "excused").map((r) => ({ memberId: r.memberId, reason: r.reason }))
        : currentExcused,
    }
  }

  async deleteSession(auth: AuthContext, groupId: string, sessionId: string): Promise<void> {
    await this.requireSession(auth, groupId, sessionId)
    await this.attendance.deleteSession(sessionId)
  }

  // Group must be visible to the caller (tag scope) and the session must
  // belong to that group in the caller's org; otherwise 404.
  private async requireSession(auth: AuthContext, groupId: string, sessionId: string) {
    await this.groups.requireVisibleGroup(auth, groupId)
    const session = await this.attendance.findSessionInGroup(auth.orgId, groupId, sessionId)
    if (!session) throw new NotFoundException("session not found")
    return session
  }

  // Every id must be on the group's roster (or in `alsoAllowed`) and appear
  // only once across present and excused. Returns the rows to store.
  private async validateAttendance(
    groupId: string,
    presentIds: string[],
    excused: SessionExcused[],
    alsoAllowed: Set<string> = new Set(),
  ): Promise<AttendanceRowInput[]> {
    const excusedIds = excused.map((e) => e.memberId)
    const all = [...presentIds, ...excusedIds]
    if (new Set(all).size !== all.length) {
      const presentSet = new Set(presentIds)
      if (excusedIds.some((id) => presentSet.has(id))) {
        throw new BadRequestException("a member cannot be both present and excused")
      }
      throw new BadRequestException("a member can only be listed once")
    }

    const rosterRows = await this.attendance.groupMemberIds(groupId)
    const roster = new Set(rosterRows.map((r) => r.memberId))
    if (all.some((id) => !roster.has(id) && !alsoAllowed.has(id))) {
      throw new BadRequestException("presentIds and excused must all be members of the group")
    }

    return [
      ...presentIds.map((memberId) => ({ memberId, status: "present" as const, reason: "" })),
      ...excused.map((e) => ({ memberId: e.memberId, status: "excused" as const, reason: e.reason ?? "" })),
    ]
  }
}
