import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sealPaystackToken } from "@/lib/paystack-token";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const raw = await request.text();
  const secret = process.env.PAYSTACK_SECRET_KEY;
  const signature = request.headers.get("Paystack-Signature");
  const signingSecret = process.env.PAYSTACK_WEBHOOK_SECRET;
  let validSignature = false;
  if (signature && signingSecret) {
    let timestamp: number | undefined;
    const signatures: string[] = [];
    for (const part of signature.split(",")) {
      const i = part.indexOf("="); if (i < 0) continue;
      const key = part.slice(0, i).trim(), value = part.slice(i + 1).trim();
      if (key === "t" && /^\d+$/.test(value)) timestamp = Number(value);
      if (key === "v1") { const colon = value.indexOf(":"); if (colon > 0) signatures.push(value.slice(colon + 1)); }
    }
    if (timestamp && Math.abs(Date.now() / 1000 - timestamp) <= 300) {
      const expected = createHmac("sha512", signingSecret).update(`${timestamp}.${raw}`).digest("hex");
      validSignature = signatures.some((candidate) => { const a = Buffer.from(candidate), b = Buffer.from(expected); return a.length === b.length && timingSafeEqual(a, b); });
    }
  } else if (secret) {
    const legacy = request.headers.get("x-paystack-signature");
    if (legacy) { const expected = createHmac("sha512", secret).update(raw).digest("hex"); const a = Buffer.from(legacy), b = Buffer.from(expected); validSignature = a.length === b.length && timingSafeEqual(a, b); }
  }
  if (!validSignature) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const event = JSON.parse(raw);
  if (event?.event === "charge.success" && event?.data?.reference) {
    const payment = await db.payment.findUnique({ where: { reference: event.data.reference } });
    if (payment && payment.status === "pending") {
      const secretKey = process.env.PAYSTACK_SECRET_KEY;
      const verify = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(payment.reference)}`, { headers: { authorization: `Bearer ${secretKey}` }, cache: "no-store" });
      const payload = await verify.json().catch(() => null);
      const tx = payload?.data;
      const valid = verify.ok && payload?.status && tx?.status === "success" && tx?.reference === payment.reference && tx?.amount === payment.amountKobo && tx?.currency === payment.currency && tx?.metadata?.userId === payment.userId && tx?.metadata?.product === payment.product;
      if (valid) {
        const changed = await db.payment.updateMany({ where: { id: payment.id, status: "pending" }, data: { status: "paid", paidAt: new Date() } });
        if (changed.count && payment.product === "exports") await db.user.update({ where: { id: payment.userId }, data: { exportPremium: true } });
        if (changed.count && payment.product === "ai") await db.user.update({ where: { id: payment.userId }, data: { aiSubscriptionUntil: tx.subscription?.next_payment_date ? new Date(tx.subscription.next_payment_date) : new Date(new Date().setMonth(new Date().getMonth() + 1)), ...(typeof tx.subscription?.subscription_code === "string" ? { paystackSubscriptionCode: tx.subscription.subscription_code } : {}), ...(typeof tx.subscription?.email_token === "string" ? { paystackEmailTokenEnc: sealPaystackToken(tx.subscription.email_token) } : {}) } });
      }
    }
    // Subsequent monthly invoices use new references. Link them through the
    // Paystack subscription code saved after the customer's first payment.
    if (!payment && typeof event.data.subscription?.subscription_code === "string") {
      const user = await db.user.findFirst({ where: { paystackSubscriptionCode: event.data.subscription.subscription_code }, select: { id: true, aiSubscriptionUntil: true, paystackSubscriptionCode: true } });
      if (user) {
        const secretKey = process.env.PAYSTACK_SECRET_KEY;
        const verify = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(String(event.data.reference))}`, { headers: { authorization: `Bearer ${secretKey}` }, cache: "no-store" });
        const payload = await verify.json().catch(() => null);
        const tx = payload?.data;
        if (verify.ok && payload?.status && tx?.status === "success" && tx?.reference === event.data.reference && tx?.amount === 300_000 && tx?.currency === "NGN" && tx?.subscription?.subscription_code === user.paystackSubscriptionCode) {
          const created = await db.payment.createMany({ data: [{ userId: user.id, reference: String(tx.reference), product: "ai", amountKobo: 300_000, status: "paid", paidAt: new Date() }], skipDuplicates: true });
          if (created.count) await db.user.update({ where: { id: user.id }, data: { aiSubscriptionUntil: tx.subscription?.next_payment_date ? new Date(tx.subscription.next_payment_date) : new Date(new Date().setMonth(new Date().getMonth() + 1)) } });
        }
      }
    }
  }
  if (event?.event === "subscription.not_renew" || event?.event === "subscription.disable") {
    const code = event?.data?.subscription_code;
    if (typeof code === "string") {
      await db.user.updateMany({ where: { paystackSubscriptionCode: code }, data: { paystackSubscriptionCode: null, paystackEmailTokenEnc: null } });
    }
  }
  if (event?.event === "invoice.payment_failed") {
    const code = event?.data?.subscription?.subscription_code;
    if (typeof code === "string") {
      await db.user.updateMany({ where: { paystackSubscriptionCode: code }, data: { aiSubscriptionUntil: new Date(), paystackSubscriptionCode: null, paystackEmailTokenEnc: null } });
    }
  }
  return NextResponse.json({ received: true });
}
