import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { groups } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [group] = await db
    .select()
    .from(groups)
    .where(and(eq(groups.id, params.id), eq(groups.churchId, session.user.churchId)))
    .limit(1);

  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(group);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const [updated] = await db
    .update(groups)
    .set({
      ...(body.name !== undefined && { name: body.name }),
      ...(body.scheduleType !== undefined && { scheduleType: body.scheduleType }),
      ...(body.meetingDay !== undefined && { meetingDay: body.meetingDay }),
      ...(body.meetingTime !== undefined && { meetingTime: body.meetingTime }),
      ...(body.location !== undefined && { location: body.location }),
      ...(body.leaderUserId !== undefined && { leaderUserId: body.leaderUserId }),
      ...(body.absenceThreshold !== undefined && { absenceThreshold: body.absenceThreshold }),
    })
    .where(and(eq(groups.id, params.id), eq(groups.churchId, session.user.churchId)))
    .returning();

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
}
