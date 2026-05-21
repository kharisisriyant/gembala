import { NextRequest, NextResponse } from "next/server";
import { validateInternalRequest } from "@/lib/internal-auth";
import { db } from "@/db";
import { members, attendanceRecords, sessions } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getVisibleMemberIds } from "@/lib/tag-access";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const caller = await validateInternalRequest(req);
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const visibleIds = await getVisibleMemberIds(caller.userId, caller.role, caller.churchId);
  if (visibleIds !== "all" && !visibleIds.includes(params.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [member] = await db
    .select()
    .from(members)
    .where(and(eq(members.id, params.id), eq(members.churchId, caller.churchId)))
    .limit(1);

  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const history = await db
    .select({
      sessionDate: sessions.sessionDate,
      status: attendanceRecords.status,
    })
    .from(attendanceRecords)
    .innerJoin(sessions, eq(attendanceRecords.sessionId, sessions.id))
    .where(eq(attendanceRecords.memberId, params.id))
    .orderBy(desc(sessions.sessionDate))
    .limit(10);

  return NextResponse.json({ ...member, attendanceHistory: history });
}
