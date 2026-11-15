import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";

const schema = z.object({ data: z.record(z.string(), z.unknown()), label: z.string().max(120).optional() });
export async function GET(_request: Request, { params }: { params: Promise<{ id:string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error:"Sign in required" }, { status:401 });
  const { id } = await params;
  const resume = await db.resume.findFirst({ where:{ id, userId:session.user.id } });
  if (!resume) return NextResponse.json({ error:"Resume not found" }, { status:404 });
  return NextResponse.json(await db.resumeVersion.findMany({ where:{ resumeId:id }, orderBy:{ createdAt:"desc" }, take:20 }));
}
export async function POST(request: Request, { params }: { params: Promise<{ id:string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error:"Sign in required" }, { status:401 });
  const { id } = await params;
  const resume = await db.resume.findFirst({ where:{ id, userId:session.user.id } });
  if (!resume) return NextResponse.json({ error:"Resume not found" }, { status:404 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error:"Invalid version data" }, { status:400 });
  return NextResponse.json(await db.resumeVersion.create({ data:{ resumeId:id, data:parsed.data.data as Prisma.InputJsonValue, label:parsed.data.label } }), { status:201 });
}
