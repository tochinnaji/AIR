import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { openPaystackToken } from "@/lib/paystack-token";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { paystackSubscriptionCode: true, paystackEmailTokenEnc: true, aiSubscriptionUntil: true } });
  if (!user?.paystackSubscriptionCode || !user.paystackEmailTokenEnc) return NextResponse.json({ error: "No cancellable AI subscription was found. Contact privacy/support for help." }, { status: 409 });
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return NextResponse.json({ error: "Subscription management is not configured." }, { status: 503 });
  const token = openPaystackToken(user.paystackEmailTokenEnc);
  const response = await fetch("https://api.paystack.co/subscription/disable", { method: "POST", headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" }, body: JSON.stringify({ code: user.paystackSubscriptionCode, token }), cache: "no-store" });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.status) return NextResponse.json({ error: "Paystack could not cancel the subscription. Try again or cancel from your Paystack email." }, { status: 502 });
  await db.user.update({ where: { id: session.user.id }, data: { paystackSubscriptionCode: null, paystackEmailTokenEnc: null } });
  return NextResponse.json({ cancelled: true, accessUntil: user.aiSubscriptionUntil });
}
