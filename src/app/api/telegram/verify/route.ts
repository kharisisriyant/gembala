import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { telegramLinkCodes, telegramLinks } from "@/db/schema";
import { eq, and, gt, isNull } from "drizzle-orm";

// Called by MCP server — secured with shared webhook secret
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-webhook-secret");
  if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { code, telegramId } = await req.json();
  if (!code || !telegramId) {
    return NextResponse.json({ error: "code and telegramId required" }, { status: 400 });
  }

  const [linkCode] = await db
    .select()
    .from(telegramLinkCodes)
    .where(
      and(
        eq(telegramLinkCodes.code, code.toUpperCase()),
        isNull(telegramLinkCodes.usedAt),
        gt(telegramLinkCodes.expiresAt, new Date())
      )
    )
    .limit(1);

  if (!linkCode) {
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
  }

  // Check if Telegram ID already linked to another account
  const [existingLink] = await db
    .select()
    .from(telegramLinks)
    .where(and(eq(telegramLinks.telegramId, String(telegramId)), isNull(telegramLinks.revokedAt)))
    .limit(1);

  if (existingLink) {
    return NextResponse.json({ error: "This Telegram account is already linked" }, { status: 409 });
  }

  // Mark code used
  await db
    .update(telegramLinkCodes)
    .set({ usedAt: new Date() })
    .where(eq(telegramLinkCodes.id, linkCode.id));

  // Create link
  await db
    .insert(telegramLinks)
    .values({ userId: linkCode.userId, telegramId: String(telegramId) })
    .onConflictDoNothing();

  return NextResponse.json({ success: true, userId: linkCode.userId });
}
