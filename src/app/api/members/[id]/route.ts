import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { members, memberTags } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getVisibleMemberIds } from "@/lib/tag-access";
import { logAudit } from "@/lib/audit";

async function assertVisible(memberId: string, session: any) {
  const visibleIds = await getVisibleMemberIds(
    session.user.id,
    session.user.role,
    session.user.churchId
  );
  if (visibleIds !== "all" && !visibleIds.includes(memberId)) return false;

  const [row] = await db
    .select({ id: members.id })
    .from(members)
    .where(and(eq(members.id, memberId), eq(members.churchId, session.user.churchId)))
    .limit(1);
  return !!row;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await assertVisible(params.id, session))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [member] = await db
    .select()
    .from(members)
    .where(eq(members.id, params.id))
    .limit(1);

  const memberTagRows = await db
    .select({ tagId: memberTags.tagId })
    .from(memberTags)
    .where(eq(memberTags.memberId, params.id));

  return NextResponse.json({ ...member, tagIds: memberTagRows.map((r) => r.tagId) });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await assertVisible(params.id, session))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const { tagIds, ...fields } = body;

  const [before] = await db.select().from(members).where(eq(members.id, params.id)).limit(1);

  const [updated] = await db
    .update(members)
    .set({
      ...(fields.fullName !== undefined && { fullName: fields.fullName }),
      ...(fields.phone !== undefined && { phone: fields.phone }),
      ...(fields.email !== undefined && { email: fields.email }),
      ...(fields.dob !== undefined && { dob: fields.dob }),
      ...(fields.address !== undefined && { address: fields.address }),
      ...(fields.gender !== undefined && { gender: fields.gender }),
      ...(fields.maritalStatus !== undefined && { maritalStatus: fields.maritalStatus }),
      ...(fields.baptisedAt !== undefined && { baptisedAt: fields.baptisedAt }),
      ...(fields.joinedAt !== undefined && { joinedAt: fields.joinedAt }),
      ...(fields.type !== undefined && { type: fields.type }),
    })
    .where(eq(members.id, params.id))
    .returning();

  if (tagIds !== undefined) {
    await db.delete(memberTags).where(eq(memberTags.memberId, params.id));
    if (tagIds.length > 0) {
      await db.insert(memberTags).values(
        tagIds.map((tagId: string) => ({
          memberId: params.id,
          tagId,
          assignedBy: session.user.id,
        }))
      );
    }
  }

  await logAudit({
    churchId: session.user.churchId,
    actorUserId: session.user.id,
    action: "member.update",
    entityType: "member",
    entityId: params.id,
    diff: { before, after: updated },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await assertVisible(params.id, session))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Soft delete (archive)
  const [updated] = await db
    .update(members)
    .set({ archivedAt: new Date() })
    .where(eq(members.id, params.id))
    .returning();

  await logAudit({
    churchId: session.user.churchId,
    actorUserId: session.user.id,
    action: "member.archive",
    entityType: "member",
    entityId: params.id,
  });

  return NextResponse.json({ success: true });
}
