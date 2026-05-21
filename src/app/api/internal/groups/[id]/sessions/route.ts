import { NextRequest, NextResponse } from "next/server";
import { validateInternalRequest } from "@/lib/internal-auth";
import { db } from "@/db";
import { sessions, groups } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const caller = await validateInternalRequest(req);
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = await db
    .select()
    .from(sessions)
    .where(eq(sessions.groupId, params.id))
    .orderBy(desc(sessions.sessionDate))
    .limit(20);

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const caller = await validateInternalRequest(req);
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const [s] = await db
    .insert(sessions)
    .values({
      groupId: params.id,
      sessionDate: body.sessionDate,
      topic: body.topic || null,
      notes: body.notes || null,
      createdBy: caller.userId,
    })
    .returning();

  return NextResponse.json(s, { status: 201 });
}
