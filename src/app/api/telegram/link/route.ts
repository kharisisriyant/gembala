import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { telegramLinkCodes, telegramLinks } from "@/db/schema";
import { eq, and, gt, isNull } from "drizzle-orm";
import crypto from "crypto";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check if already linked
  const [existing] = await db
    .select()
    .from(telegramLinks)
    .where(and(eq(telegramLinks.userId, session.user.id), isNull(telegramLinks.revokedAt)))
    .limit(1);

  if (existing) {
    return NextResponse.json({ linked: true, telegramId: existing.telegramId });
  }

  // Generate a new one-time code (10 min expiry)
  const code = crypto.randomBytes(6).toString("hex").toUpperCase();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await db.insert(telegramLinkCodes).values({
    userId: session.user.id,
    code,
    expiresAt,
  });

  const botUsername = process.env.TELEGRAM_BOT_USERNAME || "GembalaBot";
  return NextResponse.json({
    linked: false,
    code,
    expiresAt,
    instruction: `Send this code to @${botUsername} on Telegram: /link ${code}`,
  });
}

export async function DELETE() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await db
    .update(telegramLinks)
    .set({ revokedAt: new Date() })
    .where(and(eq(telegramLinks.userId, session.user.id), isNull(telegramLinks.revokedAt)));

  return NextResponse.json({ success: true });
}
