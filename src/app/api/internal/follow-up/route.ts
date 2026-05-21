import { NextRequest, NextResponse } from "next/server";
import { validateInternalRequest } from "@/lib/internal-auth";
import { db } from "@/db";
import { followUpFlags, members, groups } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const caller = await validateInternalRequest(req);
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = await db
    .select({
      id: followUpFlags.id,
      consecutiveAbsences: followUpFlags.consecutiveAbsences,
      flaggedAt: followUpFlags.flaggedAt,
      memberName: members.fullName,
      memberId: members.id,
      groupName: groups.name,
    })
    .from(followUpFlags)
    .innerJoin(members, eq(followUpFlags.memberId, members.id))
    .innerJoin(groups, eq(followUpFlags.groupId, groups.id))
    .where(
      and(eq(groups.churchId, caller.churchId), isNull(followUpFlags.resolvedAt))
    );

  return NextResponse.json(rows);
}
