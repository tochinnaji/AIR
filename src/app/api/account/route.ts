import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { openPaystackToken } from "@/lib/paystack-token";

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { paystackSubscriptionCode: true, paystackEmailTokenEnc: true } });
  if (user?.paystackSubscriptionCode && user.paystackEmailTokenEnc) {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) return NextResponse.json({ error: "Cancel your active AI subscription before deleting this account. Subscription management is temporarily unavailable." }, { status: 503 });
    const token = openPaystackToken(user.paystackEmailTokenEnc);
    const response = await fetch("https://api.paystack.co/subscription/disable", { method: "POST", headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" }, body: JSON.stringify({ code: user.paystackSubscriptionCode, token }), cache: "no-store" });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.status) return NextResponse.json({ error: "Paystack could not cancel your active AI subscription. Cancel it with Paystack, then retry account deletion." }, { status: 502 });
  }
  await db.user.delete({ where: { id: session.user.id } });
  return NextResponse.json({ deleted: true });
}
