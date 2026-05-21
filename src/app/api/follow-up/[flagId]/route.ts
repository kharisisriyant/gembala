import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { followUpFlags, groups } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function PATCH(req: NextRequest, { params }: { params: { flagId: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { resolutionNote } = await req.json();

  // Verify flag belongs to this church via group
  const [flag] = await db
    .select({ groupId: followUpFlags.groupId })
    .from(followUpFlags)
    .where(eq(followUpFlags.id, params.flagId))
    .limit(1);

  if (!flag) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [group] = await db
    .select({ churchId: groups.churchId })
    .from(groups)
    .where(eq(groups.id, flag.groupId))
    .limit(1);

  if (!group || group.churchId !== session.user.churchId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [updated] = await db
    .update(followUpFlags)
    .set({
      resolvedAt: new Date(),
      resolvedBy: session.user.id,
      resolutionNote: resolutionNote || null,
    })
    .where(eq(followUpFlags.id, params.flagId))
    .returning();

  return NextResponse.json(updated);
}
