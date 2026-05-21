import { NextRequest, NextResponse } from "next/server";
import { validateInternalRequest } from "@/lib/internal-auth";
import { db } from "@/db";
import { attendanceRecords, sessions } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; sessionId: string } }
) {
  const caller = await validateInternalRequest(req);
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const records: Array<{ member_id: string; status: string; reason?: string }> = body.records;

  const [s] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(and(eq(sessions.id, params.sessionId), eq(sessions.groupId, params.id)))
    .limit(1);

  if (!s) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  for (const rec of records) {
    const existing = await db
      .select({ id: attendanceRecords.id })
      .from(attendanceRecords)
      .where(
        and(
          eq(attendanceRecords.sessionId, params.sessionId),
          eq(attendanceRecords.memberId, rec.member_id)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(attendanceRecords)
        .set({ status: rec.status as "present" | "absent" | "excused", reason: rec.reason || null })
        .where(eq(attendanceRecords.id, existing[0].id));
    } else {
      await db.insert(attendanceRecords).values({
        sessionId: params.sessionId,
        memberId: rec.member_id,
        status: rec.status as "present" | "absent" | "excused",
        reason: rec.reason || null,
        recordedBy: caller.userId,
        source: "telegram",
      });
    }
  }

  return NextResponse.json({ success: true });
}
