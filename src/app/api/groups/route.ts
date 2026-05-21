import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { groups, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select({
      id: groups.id,
      name: groups.name,
      scheduleType: groups.scheduleType,
      meetingDay: groups.meetingDay,
      meetingTime: groups.meetingTime,
      location: groups.location,
      leaderUserId: groups.leaderUserId,
      absenceThreshold: groups.absenceThreshold,
      leaderName: users.name,
    })
    .from(groups)
    .leftJoin(users, eq(groups.leaderUserId, users.id))
    .where(eq(groups.churchId, session.user.churchId));

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, scheduleType, meetingDay, meetingTime, location, leaderUserId, absenceThreshold } = body;

  if (!name?.trim() || !leaderUserId) {
    return NextResponse.json({ error: "name and leaderUserId required" }, { status: 400 });
  }

  const [group] = await db
    .insert(groups)
    .values({
      churchId: session.user.churchId,
      name: name.trim(),
      scheduleType: scheduleType || "weekly",
      meetingDay: meetingDay || null,
      meetingTime: meetingTime || null,
      location: location || null,
      leaderUserId,
      absenceThreshold: absenceThreshold || 2,
    })
    .returning();

  await logAudit({
    churchId: session.user.churchId,
    actorUserId: session.user.id,
    action: "group.create",
    entityType: "group",
    entityId: group.id,
  });

  return NextResponse.json(group, { status: 201 });
}
