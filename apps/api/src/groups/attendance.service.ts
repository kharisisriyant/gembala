import { BadRequestException, Injectable } from "@nestjs/common"
import type { SessionCreateInput, SessionResponse } from "@gembala/shared"
import { eq } from "drizzle-orm"
import { InjectDb, type Db } from "../db/drizzle.module"
import { attendanceSessions, groupMembers, sessionAttendance } from "../db/schema"
import type { AuthContext } from "../authz/auth-context"
import { GroupsService } from "./groups.service"

@Injectable()
export class AttendanceService {
  constructor(
    @InjectDb() private readonly db: Db,
    private readonly groups: GroupsService,
  ) {}

  async logSession(
    auth: AuthContext,
    groupId: string,
    input: SessionCreateInput,
  ): Promise<SessionResponse> {
    await this.groups.requireVisibleGroup(auth, groupId)

    const rosterRows = await this.db
      .select({ memberId: groupMembers.memberId })
      .from(groupMembers)
      .where(eq(groupMembers.groupId, groupId))
    const roster = new Set(rosterRows.map((r) => r.memberId))
    const outsiders = input.presentIds.filter((id) => !roster.has(id))
    if (outsiders.length > 0) {
      throw new BadRequestException("presentIds must all be members of the group")
    }

    const created = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(attendanceSessions)
        .values({
          orgId: auth.orgId,
          groupId,
          date: input.date,
          topic: input.topic,
          prayerNotes: input.prayerNotes,
        })
        .returning()
      if (input.presentIds.length > 0) {
        await tx.insert(sessionAttendance).values(
          input.presentIds.map((memberId) => ({ sessionId: row.id, memberId })),
        )
      }
      return row
    })

    return {
      id: created.id,
      groupId,
      date: created.date,
      topic: created.topic,
      prayerNotes: created.prayerNotes,
      presentIds: input.presentIds,
    }
  }
}
