import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in to use your free trial." }, { status: 401 });
  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { exportPremium: true, exportTrialUsed: true } });
  if (user?.exportPremium) return NextResponse.json({ allowed: true, premium: true });
  const claimed = await db.user.updateMany({ where: { id: session.user.id, exportTrialUsed: false }, data: { exportTrialUsed: true } });
  if (!claimed.count) return NextResponse.json({ error: "Your one-time free export trial has been used. Unlock exports for ₦1,500." }, { status: 402 });
  return NextResponse.json({ allowed: true, trial: true });
}
