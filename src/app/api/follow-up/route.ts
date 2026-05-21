import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { followUpFlags, members, groups } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select({
      id: followUpFlags.id,
      consecutiveAbsences: followUpFlags.consecutiveAbsences,
      flaggedAt: followUpFlags.flaggedAt,
      memberName: members.fullName,
      memberId: members.id,
      groupName: groups.name,
      groupId: groups.id,
    })
    .from(followUpFlags)
    .innerJoin(members, eq(followUpFlags.memberId, members.id))
    .innerJoin(groups, eq(followUpFlags.groupId, groups.id))
    .where(
      and(
        eq(groups.churchId, session.user.churchId),
        isNull(followUpFlags.resolvedAt)
      )
    )
    .orderBy(followUpFlags.flaggedAt);

  return NextResponse.json(rows);
}
