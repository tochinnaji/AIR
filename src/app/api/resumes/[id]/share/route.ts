import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function POST(_request: Request, { params }: { params:Promise<{id:string}> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error:"Sign in required" }, { status:401 });
  const { id } = await params;
  const resume = await db.resume.findFirst({ where:{ id, userId:session.user.id } });
  if (!resume) return NextResponse.json({ error:"Resume not found" }, { status:404 });
  const token = resume.shareToken ?? randomUUID();
  if (!resume.shareToken) await db.resume.update({ where:{id}, data:{shareToken:token} });
  return NextResponse.json({ url:`${new URL(_request.url).origin}/r/${token}` });
}

export async function DELETE(_request: Request, { params }: { params:Promise<{id:string}> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error:"Sign in required" }, { status:401 });
  const { id } = await params;
  const resume = await db.resume.findFirst({ where:{ id, userId:session.user.id } });
  if (!resume) return NextResponse.json({ error:"Resume not found" }, { status:404 });
  await db.resume.update({ where:{id}, data:{shareToken:null} });
  return NextResponse.json({ shared:false });
}
