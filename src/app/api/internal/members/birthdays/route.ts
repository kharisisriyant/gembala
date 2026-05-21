import { NextRequest, NextResponse } from "next/server";
import { validateInternalRequest } from "@/lib/internal-auth";
import { db } from "@/db";
import { members } from "@/db/schema";
import { eq, isNull, and, inArray, sql } from "drizzle-orm";
import { getVisibleMemberIds } from "@/lib/tag-access";

export async function GET(req: NextRequest) {
  const caller = await validateInternalRequest(req);
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const days = parseInt(new URL(req.url).searchParams.get("days") || "7");
  const visibleIds = await getVisibleMemberIds(caller.userId, caller.role, caller.churchId);

  const today = new Date();
  const upcoming = [];

  for (let i = 0; i <= days; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const mmdd = `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    upcoming.push(mmdd);
  }

  const allActive = await db
    .select({ id: members.id, fullName: members.fullName, dob: members.dob })
    .from(members)
    .where(and(eq(members.churchId, caller.churchId), isNull(members.archivedAt)));

  const filtered = allActive.filter((m) => {
    if (!m.dob) return false;
    if (visibleIds !== "all" && !visibleIds.includes(m.id)) return false;
    const mmdd = m.dob.slice(5); // "YYYY-MM-DD" → "MM-DD"
    return upcoming.includes(mmdd);
  });

  return NextResponse.json(filtered);
}
