import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  sessions,
  attendanceRecords,
  groups,
  members,
  groupMemberships,
} from "@/db/schema";
import { eq, and, gte, lte, sql, desc, count, isNull } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const groupId = searchParams.get("groupId");
  const type = searchParams.get("type") || "attendance-rate";

  if (type === "attendance-rate" && groupId) {
    // Last 12 sessions attendance rate
    const recentSessions = await db
      .select({ id: sessions.id, sessionDate: sessions.sessionDate })
      .from(sessions)
      .where(eq(sessions.groupId, groupId))
      .orderBy(desc(sessions.sessionDate))
      .limit(12);

    const result = [];
    for (const s of recentSessions.reverse()) {
      const [totRow] = await db
        .select({ total: count() })
        .from(attendanceRecords)
        .where(eq(attendanceRecords.sessionId, s.id));

      const [presentRow] = await db
        .select({ present: count() })
        .from(attendanceRecords)
        .where(
          and(
            eq(attendanceRecords.sessionId, s.id),
            eq(attendanceRecords.status, "present")
          )
        );

      const total = Number(totRow?.total) || 0;
      const present = Number(presentRow?.present) || 0;
      result.push({
        date: s.sessionDate,
        rate: total > 0 ? Math.round((present / total) * 100) : 0,
        present,
        total,
      });
    }
    return NextResponse.json(result);
  }

  if (type === "heatmap" && groupId) {
    // Member × session attendance grid
    const recentSessions = await db
      .select({ id: sessions.id, sessionDate: sessions.sessionDate })
      .from(sessions)
      .where(eq(sessions.groupId, groupId))
      .orderBy(desc(sessions.sessionDate))
      .limit(12);

    const activeMembers = await db
      .select({ memberId: groupMemberships.memberId, fullName: members.fullName })
      .from(groupMemberships)
      .innerJoin(members, eq(groupMemberships.memberId, members.id))
      .where(and(eq(groupMemberships.groupId, groupId), isNull(groupMemberships.leftAt)));

    const heatmap = [];
    for (const m of activeMembers) {
      const row: Record<string, string | null> = { name: m.fullName };
      for (const s of recentSessions) {
        const [rec] = await db
          .select({ status: attendanceRecords.status })
          .from(attendanceRecords)
          .where(
            and(
              eq(attendanceRecords.sessionId, s.id),
              eq(attendanceRecords.memberId, m.memberId)
            )
          )
          .limit(1);
        row[s.sessionDate] = rec?.status || null;
      }
      heatmap.push(row);
    }
    return NextResponse.json({ sessions: recentSessions.map((s) => s.sessionDate).reverse(), members: heatmap });
  }

  if (type === "absence-list" && groupId) {
    // Members ranked by absences
    const activeMembers = await db
      .select({ memberId: groupMemberships.memberId, fullName: members.fullName })
      .from(groupMemberships)
      .innerJoin(members, eq(groupMemberships.memberId, members.id))
      .where(and(eq(groupMemberships.groupId, groupId), isNull(groupMemberships.leftAt)));

    const result = [];
    for (const m of activeMembers) {
      const [absRow] = await db
        .select({ absences: count() })
        .from(attendanceRecords)
        .where(
          and(
            eq(attendanceRecords.memberId, m.memberId),
            eq(attendanceRecords.status, "absent")
          )
        );
      result.push({ name: m.fullName, memberId: m.memberId, absences: Number(absRow?.absences) || 0 });
    }
    result.sort((a, b) => b.absences - a.absences);
    return NextResponse.json(result);
  }

  // Group list with summary stats for zone leaders / admins
  if (type === "summary") {
    const churchGroups = await db
      .select({ id: groups.id, name: groups.name })
      .from(groups)
      .where(eq(groups.churchId, session.user.churchId));

    return NextResponse.json(churchGroups);
  }

  return NextResponse.json({ error: "Unknown analytics type" }, { status: 400 });
}
