import { NextRequest, NextResponse } from "next/server";
import { validateInternalRequest } from "@/lib/internal-auth";
import { db } from "@/db";
import { pastoralNotes } from "@/db/schema";
import { getVisibleMemberIds } from "@/lib/tag-access";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const caller = await validateInternalRequest(req);
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const visibleIds = await getVisibleMemberIds(caller.userId, caller.role, caller.churchId);
  if (visibleIds !== "all" && !visibleIds.includes(params.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { bodyHtml, source } = await req.json();
  if (!bodyHtml) return NextResponse.json({ error: "bodyHtml required" }, { status: 400 });

  const [note] = await db
    .insert(pastoralNotes)
    .values({ memberId: params.id, authorUserId: caller.userId, bodyHtml, source: source || "telegram" })
    .returning();

  return NextResponse.json(note, { status: 201 });
}
