import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { groupMemberships, members, groups } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { logAudit } from "@/lib/audit";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select({
      membershipId: groupMemberships.id,
      joinedAt: groupMemberships.joinedAt,
      leftAt: groupMemberships.leftAt,
      memberId: members.id,
      fullName: members.fullName,
      phone: members.phone,
      type: members.type,
    })
    .from(groupMemberships)
    .innerJoin(members, eq(groupMemberships.memberId, members.id))
    .where(
      and(
        eq(groupMemberships.groupId, params.id),
        isNull(groupMemberships.leftAt),
        isNull(members.archivedAt)
      )
    );

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { memberId, joinedAt } = await req.json();
  if (!memberId) return NextResponse.json({ error: "memberId required" }, { status: 400 });

  // Close any existing active membership for this member in another group
  const existing = await db
    .select({ id: groupMemberships.id })
    .from(groupMemberships)
    .where(and(eq(groupMemberships.memberId, memberId), isNull(groupMemberships.leftAt)))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(groupMemberships)
      .set({ leftAt: joinedAt || new Date().toISOString().split("T")[0] })
      .where(eq(groupMemberships.id, existing[0].id));
  }

  const [membership] = await db
    .insert(groupMemberships)
    .values({
      groupId: params.id,
      memberId,
      joinedAt: joinedAt || new Date().toISOString().split("T")[0],
    })
    .returning();

  await logAudit({
    churchId: session.user.churchId,
    actorUserId: session.user.id,
    action: "member.transfer",
    entityType: "group_membership",
    entityId: membership.id,
    diff: { groupId: params.id, memberId },
  });

  return NextResponse.json(membership, { status: 201 });
}
