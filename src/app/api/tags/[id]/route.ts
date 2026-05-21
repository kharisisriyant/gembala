import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { tags } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { canManageTags } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageTags(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { name, colour, description } = body;

  const [updated] = await db
    .update(tags)
    .set({
      ...(name !== undefined && { name: name.trim() }),
      ...(colour !== undefined && { colour }),
      ...(description !== undefined && { description }),
    })
    .where(and(eq(tags.id, params.id), eq(tags.churchId, session.user.churchId)))
    .returning();

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await logAudit({
    churchId: session.user.churchId,
    actorUserId: session.user.id,
    action: "tag.update",
    entityType: "tag",
    entityId: params.id,
    diff: body,
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageTags(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [deleted] = await db
    .delete(tags)
    .where(and(eq(tags.id, params.id), eq(tags.churchId, session.user.churchId)))
    .returning();

  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await logAudit({
    churchId: session.user.churchId,
    actorUserId: session.user.id,
    action: "tag.delete",
    entityType: "tag",
    entityId: params.id,
  });

  return NextResponse.json({ success: true });
}
