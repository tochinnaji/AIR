import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";

const requestSchema = z.object({ kind: z.enum(["bullet", "summary", "tailor", "cover-letter"]), text: z.string().trim().min(5).max(5000), jobDescription: z.string().max(10000).optional(), consent: z.literal(true) });
const resultSchema = z.object({ suggestions: z.array(z.object({ text: z.string().min(1).max(1800), reason: z.string().max(240) })).min(1).max(4) });
const usage = new Map<string, { count: number; windowStart: number }>();
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in to use AI assistance." }, { status: 401 });
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Check the text and confirm consent before using AI." }, { status: 400 });
  const userId = session.user.id;
  const account = await db.user.findUnique({ where: { id: userId }, select: { aiTrialUsed: true, aiTrialClaimedAt: true, aiSubscriptionUntil: true } });
  const paidAi = Boolean(account?.aiSubscriptionUntil && account.aiSubscriptionUntil > new Date());
  let trialClaimed = false;
  if (!paidAi) {
    if (account?.aiTrialUsed || account?.aiTrialClaimedAt) return NextResponse.json({ error: "Your one-time AI trial has been used. Start the ₦3,000/month AI plan for more assistance and higher limits." }, { status: 402 });
    const claim = await db.user.updateMany({ where: { id: userId, aiTrialUsed: false, aiTrialClaimedAt: null }, data: { aiTrialClaimedAt: new Date() } });
    if (!claim.count) return NextResponse.json({ error: "Your AI trial is already in use or has been used. Subscribe for ₦3,000/month for more AI assistance." }, { status: 402 });
    trialClaimed = true;
  }
  const releaseTrial = async (used: boolean) => {
    if (trialClaimed) await db.user.updateMany({ where: { id: userId, aiTrialClaimedAt: { not: null } }, data: { aiTrialUsed: used, aiTrialClaimedAt: null } });
  };
  const now = Date.now(), entry = usage.get(session.user.id);
  const requestLimit = 20;
  if (paidAi && entry && now - entry.windowStart < 60_000 && entry.count >= requestLimit) return NextResponse.json({ error: "You have reached the AI limit for this minute. Try again shortly." }, { status: 429 });
  usage.set(session.user.id, !entry || now - entry.windowStart >= 60_000 ? { count: 1, windowStart: now } : { ...entry, count: entry.count + 1 });
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) { await releaseTrial(false); return NextResponse.json({ error: "AI is not configured yet. Add GEMINI_API_KEY to your environment." }, { status: 503 }); }
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite"}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: "You are a careful resume editor. Never add or infer any employer, date, degree, skill, responsibility, result, or metric not explicitly present in the user's supplied text. Preserve the original meaning. For a cover letter, write only from the provided resume facts and do not invent the recipient, company, experience, or results. Return concise, specific suggestions." }] },
        contents: [{ role: "user", parts: [{ text: `Task: ${parsed.data.kind}\nUser-provided text:\n${parsed.data.text}${parsed.data.jobDescription ? `\nJob description (use only to identify alignment, never to invent experience):\n${parsed.data.jobDescription}` : ""}` }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: { suggestions: { type: "ARRAY", minItems: 1, maxItems: 4, items: { type: "OBJECT", properties: { text: { type: "STRING" }, reason: { type: "STRING" } }, required: ["text", "reason"] } } },
            required: ["suggestions"],
          },
        },
      }),
      cache: "no-store",
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      console.error("Gemini resume rewrite request failed", { status: response.status, code: payload?.error?.status });
      await releaseTrial(false);
      if (response.status === 401 || response.status === 403) return NextResponse.json({ error: "Gemini rejected the API key or project. Check GEMINI_API_KEY and Gemini API access in Google AI Studio." }, { status: 502 });
      if (response.status === 429) return NextResponse.json({ error: "Gemini's free-tier quota or rate limit was reached. Try again later or review the project's limits in Google AI Studio." }, { status: 502 });
      return NextResponse.json({ error: "Gemini could not respond just now. Your resume is safe; try again shortly." }, { status: 502 });
    }
    const outputText = payload?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? "").join("");
    if (!outputText) { await releaseTrial(false); return NextResponse.json({ error: "Gemini returned no suggestion. Your text is unchanged; try again." }, { status: 502 }); }
    const result = resultSchema.safeParse(JSON.parse(outputText));
    if (!result.success) { await releaseTrial(false); return NextResponse.json({ error: "AI returned an invalid suggestion. Your text is unchanged; try again." }, { status: 502 }); }
    await releaseTrial(true);
    return NextResponse.json(result.data);
  } catch (error) {
    console.error("Resume rewrite failed while parsing or validating the Gemini response.");
    await releaseTrial(false);
    return NextResponse.json({ error: "AI could not respond just now. Your resume is safe; try again shortly." }, { status: 502 });
  }
}
