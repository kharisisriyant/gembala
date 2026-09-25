import { BadRequestException, Injectable } from "@nestjs/common"
import type { SessionCreateInput, SessionResponse } from "@gembala/shared"
import { InjectDb, type Db } from "../db/drizzle.module"
import type { AuthContext } from "../authz/auth-context"
import { GroupsService } from "./groups.service"
import { AttendanceRepository } from "./attendance.repository"

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

    const rosterRows = await this.attendance.groupMemberIds(groupId)
    const roster = new Set(rosterRows.map((r) => r.memberId))
    const outsiders = input.presentIds.filter((id) => !roster.has(id))
    if (outsiders.length > 0) {
      throw new BadRequestException("presentIds must all be members of the group")
    }

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
      await this.attendance.insertAttendance(row.id, input.presentIds, tx)
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
