import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { members, memberTags, tags } from "@/db/schema";
import { eq, and, isNull, inArray, or, ilike, sql } from "drizzle-orm";
import { getVisibleMemberIds } from "@/lib/tag-access";
import { logAudit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("q") || "";
  const tagFilter = searchParams.get("tag");
  const typeFilter = searchParams.get("type") as "regular" | "guest" | null;
  const includeArchived = searchParams.get("archived") === "1";

  const visibleIds = await getVisibleMemberIds(
    session.user.id,
    session.user.role,
    session.user.churchId
  );

  let query = db
    .select({
      id: members.id,
      fullName: members.fullName,
      phone: members.phone,
      email: members.email,
      gender: members.gender,
      type: members.type,
      joinedAt: members.joinedAt,
      archivedAt: members.archivedAt,
    })
    .from(members)
    .where(
      and(
        eq(members.churchId, session.user.churchId),
        includeArchived ? undefined : isNull(members.archivedAt),
        visibleIds === "all"
          ? undefined
          : visibleIds.length > 0
          ? inArray(members.id, visibleIds)
          : sql`false`,
        search
          ? or(
              ilike(members.fullName, `%${search}%`),
              ilike(members.phone, `%${search}%`),
              ilike(members.email, `%${search}%`)
            )
          : undefined,
        typeFilter ? eq(members.type, typeFilter) : undefined
      )
    )
    .$dynamic();

  let rows = await query;

  // Filter by tag if requested
  if (tagFilter) {
    const taggedMemberIds = await db
      .select({ memberId: memberTags.memberId })
      .from(memberTags)
      .where(eq(memberTags.tagId, tagFilter));
    const ids = new Set(taggedMemberIds.map((r) => r.memberId));
    rows = rows.filter((r) => ids.has(r.id));
  }

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    fullName,
    phone,
    email,
    dob,
    address,
    gender,
    maritalStatus,
    baptisedAt,
    joinedAt,
    type,
    tagIds,
  } = body;

  if (!fullName?.trim() || !joinedAt) {
    return NextResponse.json({ error: "fullName and joinedAt required" }, { status: 400 });
  }

  const [member] = await db
    .insert(members)
    .values({
      churchId: session.user.churchId,
      fullName: fullName.trim(),
      phone: phone || null,
      email: email || null,
      dob: dob || null,
      address: address || null,
      gender: gender || null,
      maritalStatus: maritalStatus || null,
      baptisedAt: baptisedAt || null,
      joinedAt,
      type: type || "regular",
    })
    .returning();

  if (tagIds && tagIds.length > 0) {
    await db.insert(memberTags).values(
      tagIds.map((tagId: string) => ({
        memberId: member.id,
        tagId,
        assignedBy: session.user.id,
      }))
    );
  }

  await logAudit({
    churchId: session.user.churchId,
    actorUserId: session.user.id,
    action: "member.create",
    entityType: "member",
    entityId: member.id,
    diff: { fullName, type },
  });

  return NextResponse.json(member, { status: 201 });
}
