import { Injectable } from "@nestjs/common"
import { eq } from "drizzle-orm"
import { InjectDb, type Db, type Tx } from "../db/drizzle.module"
import { attendanceSessions, groupMembers, sessionAttendance } from "../db/schema"

export type SessionInsert = typeof attendanceSessions.$inferInsert

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

  async insertAttendance(sessionId: string, memberIds: string[], tx: Db | Tx = this.db) {
    if (memberIds.length === 0) return
    await tx.insert(sessionAttendance).values(memberIds.map((memberId) => ({ sessionId, memberId })))
  }
}
