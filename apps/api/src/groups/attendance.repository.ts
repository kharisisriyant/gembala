import { Injectable } from "@nestjs/common"
import { and, eq } from "drizzle-orm"
import { InjectDb, type Db, type Tx } from "../db/drizzle.module"
import { attendanceSessions, groupMembers, sessionAttendance } from "../db/schema"

export type SessionInsert = typeof attendanceSessions.$inferInsert
export type SessionPatch = Partial<Pick<SessionInsert, "date" | "topic" | "prayerNotes">>
export type AttendanceRowInput = {
  memberId: string
  status: (typeof sessionAttendance.$inferInsert)["status"]
  reason: string
}

@Injectable()
export class AttendanceRepository {
  constructor(@InjectDb() private readonly db: Db) {}

  async groupMemberIds(groupId: string, tx: Db | Tx = this.db) {
    return tx.select({ memberId: groupMembers.memberId }).from(groupMembers).where(eq(groupMembers.groupId, groupId))
  }

  async insertSession(input: SessionInsert, tx: Db | Tx = this.db) {
    const [row] = await tx.insert(attendanceSessions).values(input).returning()
    return row
  }

  async insertAttendance(sessionId: string, rows: AttendanceRowInput[], tx: Db | Tx = this.db) {
    if (rows.length === 0) return
    await tx.insert(sessionAttendance).values(rows.map((r) => ({ sessionId, ...r })))
  }

  // The session only if it belongs to this group in this org.
  async findSessionInGroup(
    orgId: string,
    groupId: string,
    sessionId: string,
    tx: Db | Tx = this.db,
  ): Promise<typeof attendanceSessions.$inferSelect | undefined> {
    const [row] = await tx
      .select()
      .from(attendanceSessions)
      .where(
        and(
          eq(attendanceSessions.id, sessionId),
          eq(attendanceSessions.groupId, groupId),
          eq(attendanceSessions.orgId, orgId),
        ),
      )
    return row
  }

  async attendanceRows(sessionId: string, tx: Db | Tx = this.db) {
    return tx
      .select({ memberId: sessionAttendance.memberId, status: sessionAttendance.status, reason: sessionAttendance.reason })
      .from(sessionAttendance)
      .where(eq(sessionAttendance.sessionId, sessionId))
  }

  async updateSession(sessionId: string, patch: SessionPatch, tx: Db | Tx = this.db) {
    if (Object.keys(patch).length === 0) {
      const [row] = await tx.select().from(attendanceSessions).where(eq(attendanceSessions.id, sessionId))
      return row
    }
    const [row] = await tx.update(attendanceSessions).set(patch).where(eq(attendanceSessions.id, sessionId)).returning()
    return row
  }

  async replaceAttendance(sessionId: string, rows: AttendanceRowInput[], tx: Db | Tx = this.db) {
    await tx.delete(sessionAttendance).where(eq(sessionAttendance.sessionId, sessionId))
    await this.insertAttendance(sessionId, rows, tx)
  }

  // Attendance rows go with it via ON DELETE CASCADE.
  async deleteSession(sessionId: string, tx: Db | Tx = this.db) {
    await tx.delete(attendanceSessions).where(eq(attendanceSessions.id, sessionId))
  }
}
