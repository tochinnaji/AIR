import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { sealPaystackToken } from "@/lib/paystack-token";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await auth();
  const url = new URL(request.url);
  const reference = url.searchParams.get("reference") ?? "";
  const returnTo = new URL("/", request.url);
  if (!session?.user?.id) { returnTo.searchParams.set("billing", "signin"); return NextResponse.redirect(returnTo); }
  const payment = await db.payment.findUnique({ where: { reference } });
  if (!payment || payment.userId !== session.user.id) { returnTo.searchParams.set("billing", "failed"); return NextResponse.redirect(returnTo); }
  if (payment.status !== "paid") {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) { returnTo.searchParams.set("billing", "pending"); return NextResponse.redirect(returnTo); }
    const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, { headers: { authorization: `Bearer ${secret}` }, cache: "no-store" });
    const verified = await response.json().catch(() => null);
    const tx = verified?.data;
    const isValid = response.ok && verified?.status && tx?.status === "success" && tx?.reference === reference && tx?.amount === payment.amountKobo && tx?.currency === payment.currency && tx?.metadata?.userId === payment.userId && tx?.metadata?.product === payment.product;
    if (!isValid) { returnTo.searchParams.set("billing", "failed"); return NextResponse.redirect(returnTo); }
    const changed = await db.payment.updateMany({ where: { reference, status: "pending" }, data: { status: "paid", paidAt: new Date() } });
    if (changed.count) {
      if (payment.product === "exports") await db.user.update({ where: { id: payment.userId }, data: { exportPremium: true } });
      if (payment.product === "ai") await db.user.update({ where: { id: payment.userId }, data: { aiSubscriptionUntil: tx.subscription?.next_payment_date ? new Date(tx.subscription.next_payment_date) : new Date(new Date().setMonth(new Date().getMonth() + 1)), ...(typeof tx.subscription?.subscription_code === "string" ? { paystackSubscriptionCode: tx.subscription.subscription_code } : {}), ...(typeof tx.subscription?.email_token === "string" ? { paystackEmailTokenEnc: sealPaystackToken(tx.subscription.email_token) } : {}) } });
    }
  }
  returnTo.searchParams.set("billing", "success");
  return NextResponse.redirect(returnTo);
}
