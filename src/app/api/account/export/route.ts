import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      exportTrialUsed: true,
      exportPremium: true,
      aiTrialUsed: true,
      aiSubscriptionUntil: true,
      payments: { orderBy: { createdAt: "desc" }, select: { reference: true, product: true, amountKobo: true, currency: true, status: true, createdAt: true, paidAt: true } },
      resumes: {
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          title: true,
          data: true,
          createdAt: true,
          updatedAt: true,
          versions: {
            orderBy: { createdAt: "desc" },
            select: { id: true, label: true, data: true, createdAt: true },
          },
        },
      },
    },
  });

  if (!user) return NextResponse.json({ error: "Account not found" }, { status: 404 });
  return new NextResponse(JSON.stringify({ exportedAt: new Date().toISOString(), account: user }, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="forme-account-${user.id}.json"`,
      "cache-control": "private, no-store, max-age=0",
      "x-content-type-options": "nosniff",
    },
  });
}
