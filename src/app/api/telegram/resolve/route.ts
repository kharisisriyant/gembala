import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { telegramLinks, users } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-webhook-secret");
  if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const telegramId = req.headers.get("x-telegram-id");
  if (!telegramId) return NextResponse.json({ error: "Missing telegram ID" }, { status: 400 });

  const [link] = await db
    .select({
      userId: telegramLinks.userId,
      userChurchId: users.churchId,
      userRole: users.role,
    })
    .from(telegramLinks)
    .innerJoin(users, eq(telegramLinks.userId, users.id))
    .where(
      and(
        eq(telegramLinks.telegramId, telegramId),
        isNull(telegramLinks.revokedAt)
      )
    )
    .limit(1);

  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    id: link.userId,
    churchId: link.userChurchId,
    role: link.userRole,
  });
}
