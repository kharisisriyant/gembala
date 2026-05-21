import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/db";
import { users, churches } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

export type UserRole = "super_admin" | "admin" | "zone_leader" | "cell_leader";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: UserRole;
      churchId: string;
      churchSlug: string;
    };
  }
  interface User {
    role: UserRole;
    churchId: string;
    churchSlug: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: UserRole;
    churchId: string;
    churchSlug: string;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const [user] = await db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            hashedPassword: users.hashedPassword,
            role: users.role,
            churchId: users.churchId,
            deactivatedAt: users.deactivatedAt,
            churchSlug: churches.slug,
          })
          .from(users)
          .innerJoin(churches, eq(users.churchId, churches.id))
          .where(eq(users.email, credentials.email as string))
          .limit(1);

        if (!user || user.deactivatedAt) return null;

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.hashedPassword
        );
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role as UserRole,
          churchId: user.churchId,
          churchSlug: user.churchSlug,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.churchId = user.churchId;
        token.churchSlug = user.churchSlug;
      }
      return token;
    },
    session({ session, token }) {
      session.user.role = token.role;
      session.user.churchId = token.churchId;
      session.user.churchSlug = token.churchSlug;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
});
