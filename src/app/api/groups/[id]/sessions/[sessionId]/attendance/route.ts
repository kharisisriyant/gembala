import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  attendanceRecords,
  sessions,
  groupMemberships,
  members,
  followUpFlags,
  groups,
} from "@/db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";

interface AttendanceRecord {
  memberId: string;
  status: "present" | "absent" | "excused";
  reason?: string;
}

async function checkAndFlagAbsences(groupId: string, churchId: string) {
  const [group] = await db
    .select({ absenceThreshold: groups.absenceThreshold })
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);

  if (!group) return;
  const threshold = group.absenceThreshold;

  // Get active members
  const activeMembers = await db
    .select({ memberId: groupMemberships.memberId })
    .from(groupMemberships)
    .where(and(eq(groupMemberships.groupId, groupId), isNull(groupMemberships.leftAt)));

  // Get recent sessions ordered by date desc
  const recentSessions = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(eq(sessions.groupId, groupId))
    .orderBy(desc(sessions.sessionDate))
    .limit(threshold + 2);

  for (const { memberId } of activeMembers) {
    let consecutive = 0;
    for (const { id: sessionId } of recentSessions) {
      const [record] = await db
        .select({ status: attendanceRecords.status })
        .from(attendanceRecords)
        .where(
          and(
            eq(attendanceRecords.sessionId, sessionId),
            eq(attendanceRecords.memberId, memberId)
          )
        )
        .limit(1);

      if (!record || record.status === "absent") {
        consecutive++;
      } else {
        break;
      }
    }

    if (consecutive >= threshold) {
      // Upsert follow-up flag (only if not already flagged)
      const [existing] = await db
        .select({ id: followUpFlags.id })
        .from(followUpFlags)
        .where(
          and(
            eq(followUpFlags.memberId, memberId),
            eq(followUpFlags.groupId, groupId),
            isNull(followUpFlags.resolvedAt)
          )
        )
        .limit(1);

      if (!existing) {
        await db.insert(followUpFlags).values({
          memberId,
          groupId,
          consecutiveAbsences: consecutive,
        });
      }
    }
  }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string; sessionId: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select({
      id: attendanceRecords.id,
      memberId: attendanceRecords.memberId,
      status: attendanceRecords.status,
      reason: attendanceRecords.reason,
      source: attendanceRecords.source,
      fullName: members.fullName,
    })
    .from(attendanceRecords)
    .innerJoin(members, eq(attendanceRecords.memberId, members.id))
    .where(eq(attendanceRecords.sessionId, params.sessionId));

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest, { params }: { params: { id: string; sessionId: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const records: AttendanceRecord[] = body.records;

  if (!Array.isArray(records) || records.length === 0) {
    return NextResponse.json({ error: "records array required" }, { status: 400 });
  }

  // Verify session belongs to group
  const [s] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(and(eq(sessions.id, params.sessionId), eq(sessions.groupId, params.id)))
    .limit(1);

  if (!s) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  // Upsert records
  for (const rec of records) {
    const existing = await db
      .select({ id: attendanceRecords.id })
      .from(attendanceRecords)
      .where(
        and(
          eq(attendanceRecords.sessionId, params.sessionId),
          eq(attendanceRecords.memberId, rec.memberId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(attendanceRecords)
        .set({ status: rec.status, reason: rec.reason || null })
        .where(eq(attendanceRecords.id, existing[0].id));
    } else {
      await db.insert(attendanceRecords).values({
        sessionId: params.sessionId,
        memberId: rec.memberId,
        status: rec.status,
        reason: rec.reason || null,
        recordedBy: session.user.id,
        source: body.source || "web",
      });
    }
  }

  // Check for consecutive absences and flag members
  const [groupRow] = await db
    .select({ churchId: groups.churchId })
    .from(groups)
    .where(eq(groups.id, params.id))
    .limit(1);

  if (groupRow) {
    await checkAndFlagAbsences(params.id, groupRow.churchId);
  }

  return NextResponse.json({ success: true });
}
