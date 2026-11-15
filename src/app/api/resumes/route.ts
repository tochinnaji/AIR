import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";

const resumeSchema = z.object({ id: z.string().optional(), title: z.string().max(120), data: z.record(z.string(), z.unknown()) });
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  return NextResponse.json(await db.resume.findMany({ where: { userId: session.user.id }, orderBy: { updatedAt: "desc" } }));
}
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const parsed = resumeSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid resume data" }, { status: 400 });
  const { id, title, data } = parsed.data;
  if (id && !(await db.resume.findFirst({ where: { id, userId: session.user.id } }))) return NextResponse.json({ error: "Resume not found" }, { status: 404 });
  const jsonData = data as Prisma.InputJsonValue;
  const resume = id ? await db.resume.update({ where: { id }, data: { title, data:jsonData } }) : await db.resume.create({ data: { userId: session.user.id, title, data:jsonData } });
  return NextResponse.json(resume);
}
