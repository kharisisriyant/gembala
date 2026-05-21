import { auth } from "@/lib/auth";
import { db } from "@/db";
import { followUpFlags, members, groups } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await auth();

  const flags = await db
    .select({
      id: followUpFlags.id,
      consecutiveAbsences: followUpFlags.consecutiveAbsences,
      memberName: members.fullName,
      memberId: members.id,
      groupName: groups.name,
    })
    .from(followUpFlags)
    .innerJoin(members, eq(followUpFlags.memberId, members.id))
    .innerJoin(groups, eq(followUpFlags.groupId, groups.id))
    .where(
      and(
        eq(groups.churchId, session!.user.churchId),
        isNull(followUpFlags.resolvedAt)
      )
    )
    .limit(10);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-2">Dashboard</h1>
      <p className="text-gray-500 mb-6">Welcome back, {session?.user?.name}.</p>

      {flags.length > 0 && (
        <div className="bg-white border border-red-200 rounded-xl p-5 max-w-xl">
          <h2 className="text-sm font-semibold text-red-600 mb-3">
            Needs Follow-Up ({flags.length})
          </h2>
          <div className="space-y-2">
            {flags.map((f) => (
              <div key={f.id} className="flex items-center gap-3">
                <Link
                  href={`/members/${f.memberId}`}
                  className="flex-1 text-sm font-medium text-gray-900 hover:text-indigo-600"
                >
                  {f.memberName}
                </Link>
                <span className="text-xs text-gray-500">{f.groupName}</span>
                <span className="text-xs text-red-500">{f.consecutiveAbsences} absent</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {flags.length === 0 && (
        <div className="max-w-xl bg-green-50 border border-green-200 rounded-xl p-5">
          <p className="text-sm text-green-700">No members currently need follow-up.</p>
        </div>
      )}
    </div>
  );
}
