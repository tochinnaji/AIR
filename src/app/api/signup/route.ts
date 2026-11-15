import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";

const signupSchema = z.object({ name: z.string().trim().min(1).max(80), email: z.string().trim().email().max(254), password: z.string().min(10).max(128) });
export async function POST(request: Request) {
  const parsed = signupSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Enter a name, valid email and password (10+ characters)." }, { status: 400 });
  const email = parsed.data.email.toLowerCase();
  if (await db.user.findUnique({ where: { email } })) return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
  const user = await db.user.create({ data: { name: parsed.data.name, email, passwordHash: await hash(parsed.data.password, 12) } });
  return NextResponse.json({ id: user.id }, { status: 201 });
}
