import { NextRequest, NextResponse } from "next/server";
import { validateInternalRequest } from "@/lib/internal-auth";
import { db } from "@/db";
import { members, memberTags } from "@/db/schema";
import { eq, and, isNull, inArray, or, ilike, sql } from "drizzle-orm";
import { getVisibleMemberIds } from "@/lib/tag-access";

export async function GET(req: NextRequest) {
  const caller = await validateInternalRequest(req);
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("q") || "";
  const tagFilter = searchParams.get("tag");

  const visibleIds = await getVisibleMemberIds(caller.userId, caller.role, caller.churchId);

  let rows = await db
    .select({
      id: members.id,
      fullName: members.fullName,
      phone: members.phone,
      email: members.email,
      type: members.type,
      joinedAt: members.joinedAt,
    })
    .from(members)
    .where(
      and(
        eq(members.churchId, caller.churchId),
        isNull(members.archivedAt),
        visibleIds === "all"
          ? undefined
          : visibleIds.length > 0
          ? inArray(members.id, visibleIds)
          : sql`false`,
        search
          ? or(ilike(members.fullName, `%${search}%`), ilike(members.phone, `%${search}%`))
          : undefined
      )
    );

  if (tagFilter) {
    const taggedIds = (
      await db.select({ memberId: memberTags.memberId }).from(memberTags).where(eq(memberTags.tagId, tagFilter))
    ).map((r) => r.memberId);
    rows = rows.filter((r) => taggedIds.includes(r.id));
  }

  return NextResponse.json(rows);
}
