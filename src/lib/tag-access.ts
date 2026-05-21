import { db } from "@/db";
import { userTagAccess, memberTags } from "@/db/schema";
import { eq, inArray, and } from "drizzle-orm";
import type { UserRole } from "@/lib/auth";

/**
 * Returns tag IDs the given user has access to.
 * Admins and super_admins get all tags (pass allTagIds for that path).
 */
export async function getAccessibleTagIds(
  userId: string,
  role: UserRole,
  allTagIds: string[]
): Promise<string[]> {
  if (role === "admin" || role === "super_admin") return allTagIds;

  const rows = await db
    .select({ tagId: userTagAccess.tagId })
    .from(userTagAccess)
    .where(eq(userTagAccess.userId, userId));

  return rows.map((r) => r.tagId);
}

/**
 * Returns member IDs visible to the user based on their tag access.
 * Admins see all members. Leaders see members with at least one matching tag.
 * Members with no tags are invisible to leaders.
 */
export async function getVisibleMemberIds(
  userId: string,
  role: UserRole,
  churchId: string
): Promise<string[] | "all"> {
  if (role === "admin" || role === "super_admin") return "all";

  const accessRows = await db
    .select({ tagId: userTagAccess.tagId })
    .from(userTagAccess)
    .where(eq(userTagAccess.userId, userId));

  const tagIds = accessRows.map((r) => r.tagId);
  if (tagIds.length === 0) return [];

  const memberRows = await db
    .select({ memberId: memberTags.memberId })
    .from(memberTags)
    .where(inArray(memberTags.tagId, tagIds));

  return [...new Set(memberRows.map((r) => r.memberId))];
}
