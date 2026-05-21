import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { churches, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { churchName, slug, adminName, email, password } = body;

    if (!churchName || !slug || !adminName || !email || !password) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    if (!/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json(
        { error: "Slug must be lowercase letters, numbers, and hyphens only" },
        { status: 400 }
      );
    }

    // Check slug uniqueness
    const existing = await db
      .select({ id: churches.id })
      .from(churches)
      .where(eq(churches.slug, slug))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json({ error: "Slug already taken" }, { status: 409 });
    }

    // Check email uniqueness
    const existingEmail = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingEmail.length > 0) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const [church] = await db
      .insert(churches)
      .values({ name: churchName, slug })
      .returning();

    await db.insert(users).values({
      churchId: church.id,
      name: adminName,
      email,
      hashedPassword,
      role: "admin",
    });

    return NextResponse.json({ success: true, churchId: church.id }, { status: 201 });
  } catch (err) {
    console.error("Church registration error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
