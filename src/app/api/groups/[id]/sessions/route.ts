import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { sessions, groups } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select()
    .from(sessions)
    .where(eq(sessions.groupId, params.id))
    .orderBy(desc(sessions.sessionDate));

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { sessionDate, topic, notes } = body;

  if (!sessionDate) {
    return NextResponse.json({ error: "sessionDate required" }, { status: 400 });
  }

  const [s] = await db
    .insert(sessions)
    .values({
      groupId: params.id,
      sessionDate,
      topic: topic || null,
      notes: notes || null,
      createdBy: session.user.id,
    })
    .returning();

  return NextResponse.json(s, { status: 201 });
}
