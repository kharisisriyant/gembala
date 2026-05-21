import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { pastoralNotes, members, users } from "@/db/schema";
import { eq, and, or } from "drizzle-orm";
import { getVisibleMemberIds } from "@/lib/tag-access";
import { isAdmin } from "@/lib/rbac";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const visibleIds = await getVisibleMemberIds(
    session.user.id,
    session.user.role,
    session.user.churchId
  );

  if (visibleIds !== "all" && !visibleIds.includes(params.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Notes visible to author OR admin
  const rows = await db
    .select({
      id: pastoralNotes.id,
      bodyHtml: pastoralNotes.bodyHtml,
      source: pastoralNotes.source,
      createdAt: pastoralNotes.createdAt,
      attachments: pastoralNotes.attachments,
      authorName: users.name,
    })
    .from(pastoralNotes)
    .innerJoin(users, eq(pastoralNotes.authorUserId, users.id))
    .where(
      and(
        eq(pastoralNotes.memberId, params.id),
        isAdmin(session.user.role)
          ? undefined
          : eq(pastoralNotes.authorUserId, session.user.id)
      )
    )
    .orderBy(pastoralNotes.createdAt);

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const visibleIds = await getVisibleMemberIds(
    session.user.id,
    session.user.role,
    session.user.churchId
  );

  if (visibleIds !== "all" && !visibleIds.includes(params.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const { bodyHtml, source } = body;

  if (!bodyHtml?.trim()) {
    return NextResponse.json({ error: "bodyHtml required" }, { status: 400 });
  }

  const [note] = await db
    .insert(pastoralNotes)
    .values({
      memberId: params.id,
      authorUserId: session.user.id,
      bodyHtml: bodyHtml.trim(),
      source: source || "web",
    })
    .returning();

  return NextResponse.json(note, { status: 201 });
}
