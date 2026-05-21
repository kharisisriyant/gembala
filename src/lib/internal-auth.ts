import { NextRequest } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { UserRole } from "@/lib/auth";

export interface InternalCaller {
  userId: string;
  churchId: string;
  role: UserRole;
}

export async function validateInternalRequest(
  req: NextRequest
): Promise<InternalCaller | null> {
  const secret = req.headers.get("x-webhook-secret");
  if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) return null;

  const userId = req.headers.get("x-internal-user-id");
  const churchId = req.headers.get("x-internal-church-id");
  if (!userId || !churchId) return null;

  const [user] = await db
    .select({ id: users.id, role: users.role, churchId: users.churchId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user || user.churchId !== churchId) return null;

  return { userId: user.id, churchId: user.churchId, role: user.role as UserRole };
}
