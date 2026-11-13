import { Injectable } from "@nestjs/common"
import { and, eq, isNotNull } from "drizzle-orm"
import { InjectDb, type Db } from "../db/drizzle.module"
import { careRequests, members, orgMemberships, users } from "../db/schema"

export type OpenCareRequest = {
  id: string
  orgId: string
  memberId: string
  memberName: string
  type: "prayer" | "care"
  assignedToId: string
  dueAt: string
}

@Injectable()
export class RemindersRepository {
  constructor(@InjectDb() private readonly db: Db) {}

  // Open requests that have both an owner and a due date, across every org.
  openOwnedWithDueDate(): Promise<OpenCareRequest[]> {
    return this.db
      .select({
        id: careRequests.id,
        orgId: careRequests.orgId,
        memberId: careRequests.memberId,
        memberName: members.name,
        type: careRequests.type,
        assignedToId: careRequests.assignedToUserId,
        dueAt: careRequests.dueAt,
      })
      .from(careRequests)
      .innerJoin(members, eq(members.id, careRequests.memberId))
      .where(and(eq(careRequests.status, "open"), isNotNull(careRequests.assignedToUserId), isNotNull(careRequests.dueAt))) as Promise<OpenCareRequest[]>
  }

  activeUserIds(): Promise<{ userId: string }[]> {
    return this.db
      .selectDistinct({ userId: users.id })
      .from(orgMemberships)
      .innerJoin(users, eq(users.id, orgMemberships.userId))
      .where(eq(users.authStatus, "active"))
  }
}
