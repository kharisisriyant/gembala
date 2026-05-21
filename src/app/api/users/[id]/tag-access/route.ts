import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { userTagAccess, users, tags } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { canGrantTagAccess } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canGrantTagAccess(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await db
    .select({ tag: tags })
    .from(userTagAccess)
    .innerJoin(tags, eq(userTagAccess.tagId, tags.id))
    .where(
      and(
        eq(userTagAccess.userId, params.id),
        eq(tags.churchId, session.user.churchId)
      )
    );

  return NextResponse.json(rows.map((r) => r.tag));
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canGrantTagAccess(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { tagId } = await req.json();
  if (!tagId) return NextResponse.json({ error: "tagId required" }, { status: 400 });

  // Verify tag belongs to this church
  const [tag] = await db
    .select()
    .from(tags)
    .where(and(eq(tags.id, tagId), eq(tags.churchId, session.user.churchId)))
    .limit(1);

  if (!tag) return NextResponse.json({ error: "Tag not found" }, { status: 404 });

  await db
    .insert(userTagAccess)
    .values({ userId: params.id, tagId, grantedBy: session.user.id })
    .onConflictDoNothing();

  await logAudit({
    churchId: session.user.churchId,
    actorUserId: session.user.id,
    action: "tag.access.grant",
    entityType: "user",
    entityId: params.id,
    diff: { tagId },
  });

  return NextResponse.json({ success: true }, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canGrantTagAccess(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { tagId } = await req.json();
  if (!tagId) return NextResponse.json({ error: "tagId required" }, { status: 400 });

  await db
    .delete(userTagAccess)
    .where(
      and(eq(userTagAccess.userId, params.id), eq(userTagAccess.tagId, tagId))
    );

  await logAudit({
    churchId: session.user.churchId,
    actorUserId: session.user.id,
    action: "tag.access.revoke",
    entityType: "user",
    entityId: params.id,
    diff: { tagId },
  });

  return NextResponse.json({ success: true });
}
