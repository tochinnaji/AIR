import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { compare } from "bcryptjs";
import { db } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  trustHost: process.env.AUTH_TRUST_HOST === "true",
  session: { strategy: "jwt" },
  pages: { signIn: "/signin" },
  providers: [Google, Credentials({
    credentials: { email: {}, password: {} },
    async authorize(credentials) {
      const email = String(credentials.email ?? "").toLowerCase().trim();
      const password = String(credentials.password ?? "");
      const user = await db.user.findUnique({ where: { email } });
      if (!user?.passwordHash || !(await compare(password, user.passwordHash))) return null;
      return { id: user.id, email: user.email, name: user.name };
    }
  })],
  callbacks: { jwt({ token, user }) { if (user) token.userId = user.id; return token; }, session({ session, token }) { if (session.user && token.userId) session.user.id = String(token.userId); return session; } }
});
