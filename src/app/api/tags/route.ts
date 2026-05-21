import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { tags } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { canManageTags } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select()
    .from(tags)
    .where(eq(tags.churchId, session.user.churchId));

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageTags(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { name, colour, description } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const [tag] = await db
    .insert(tags)
    .values({
      churchId: session.user.churchId,
      name: name.trim(),
      colour: colour || "#6366f1",
      description: description || null,
    })
    .returning();

  await logAudit({
    churchId: session.user.churchId,
    actorUserId: session.user.id,
    action: "tag.create",
    entityType: "tag",
    entityId: tag.id,
    diff: { name, colour, description },
  });

  return NextResponse.json(tag, { status: 201 });
}
