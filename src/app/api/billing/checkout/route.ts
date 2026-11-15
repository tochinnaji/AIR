import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const offers = {
  exports: { amount: 150_000, name: "Forme Export unlock", once: true },
  ai: { amount: 300_000, name: "Forme AI monthly", once: false },
} as const;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in before starting checkout." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const product = body?.product as keyof typeof offers;
  if (!Object.hasOwn(offers, product)) return NextResponse.json({ error: "Choose a valid Forme offer." }, { status: 400 });
  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { id: true, email: true, exportPremium: true, aiSubscriptionUntil: true } });
  if (!user?.email) return NextResponse.json({ error: "Add an email address to your account before paying." }, { status: 400 });
  if (product === "exports" && user.exportPremium) return NextResponse.json({ error: "Export features are already unlocked." }, { status: 409 });
  if (product === "ai" && user.aiSubscriptionUntil && user.aiSubscriptionUntil > new Date()) return NextResponse.json({ error: "AI Premium is already active." }, { status: 409 });
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return NextResponse.json({ error: "Paystack checkout is not configured yet." }, { status: 503 });
  const plan = process.env.PAYSTACK_AI_PLAN_CODE;
  if (product === "ai" && process.env.PAYSTACK_AI_BILLING_ENABLED !== "true") return NextResponse.json({ error: "AI payments will open after the AI provider is confirmed working. You will not be charged yet." }, { status: 503 });
  if (product === "ai" && !plan) return NextResponse.json({ error: "The monthly AI plan is not configured in Paystack yet." }, { status: 503 });

  const reference = `forme_${product}_${randomUUID().replaceAll("-", "")}`;
  const offer = offers[product];
  await db.payment.create({ data: { userId: user.id, reference, product, amountKobo: offer.amount } });
  const callback = new URL("/api/billing/verify", request.url);
  callback.searchParams.set("reference", reference);
  const response = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
    body: JSON.stringify({ email: user.email, amount: offer.amount, currency: "NGN", reference, callback_url: callback.toString(), metadata: { userId: user.id, product, custom_fields: [{ display_name: "Offer", variable_name: "offer", value: offer.name }] }, ...(product === "ai" ? { plan } : {}) }),
    cache: "no-store",
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.status || !result?.data?.authorization_url) {
    await db.payment.update({ where: { reference }, data: { status: "initialization_failed" } });
    console.error("Paystack checkout initialization failed", { status: response.status, product });
    return NextResponse.json({ error: "Paystack could not start checkout. Please try again." }, { status: 502 });
  }
  await db.payment.update({ where: { reference }, data: { paystackCode: result.data.access_code } });
  return NextResponse.json({ authorizationUrl: result.data.authorization_url });
}
