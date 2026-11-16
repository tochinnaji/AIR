import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { createAiCacheKey, getAiCachedResponse, setAiCachedResponse } from "@/lib/ai-cache";

const requestSchema = z.object({ kind: z.enum(["bullet", "summary", "tailor", "cover-letter"]), text: z.string().trim().min(5).max(5000), jobDescription: z.string().max(10000).optional(), consent: z.literal(true) });
const resultSchema = z.object({ suggestions: z.array(z.object({ text: z.string().min(1).max(1800), reason: z.string().max(240), evidence: z.array(z.string().min(1).max(300)).min(1).max(6) })).min(1).max(4) });
const encoder = new TextEncoder();
let lastUsagePruneAt = 0;

function containsUnsupportedNumbers(source: string, output: string) {
  const normalize = (value: string) => value.replace(/[,.\s]/g, "");
  const pattern = /\b\d+(?:[,.]\d+)*(?:\s?%|\s?(?:percent|years?|months?|weeks?|days?|users?|customers?|teams?|projects?|launches?|million|billion|k|m|bn))?/gi;
  const sourceNumbers = new Set((source.match(pattern) ?? []).map(normalize));
  return (output.match(pattern) ?? []).map(normalize).some((number) => !sourceNumbers.has(number));
}

function includesEvidence(source: string, evidence: string) {
  const normalizedSource = source.replace(/\s+/g, " ").trim().toLocaleLowerCase();
  const normalizedEvidence = evidence.replace(/\s+/g, " ").trim().toLocaleLowerCase();
  return normalizedEvidence.length >= 3 && normalizedSource.includes(normalizedEvidence);
}

function errorResponse(message: string, status: number) { return NextResponse.json({ error: message }, { status }); }
function ndjsonResponse(body: ReadableStream<Uint8Array>) {
  return new Response(body, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-cache, no-store, must-revalidate", "x-accel-buffering": "no" } });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return errorResponse("Sign in to use AI assistance.", 401);
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Check the text and confirm consent before using AI.", 400);

  const userId = session.user.id;
  const account = await db.user.findUnique({ where: { id: userId }, select: { aiTrialUsed: true, aiTrialClaimedAt: true, aiSubscriptionUntil: true } });
  const paidAi = Boolean(account?.aiSubscriptionUntil && account.aiSubscriptionUntil > new Date());
  let trialClaimed = false;
  if (!paidAi) {
    if (account?.aiTrialUsed || account?.aiTrialClaimedAt) return errorResponse("Your one-time AI trial has been used. Start the ₦3,000/month AI plan for more assistance and higher limits.", 402);
    const claim = await db.user.updateMany({ where: { id: userId, aiTrialUsed: false, aiTrialClaimedAt: null }, data: { aiTrialClaimedAt: new Date() } });
    if (!claim.count) return errorResponse("Your AI trial is already in use or has been used. Subscribe for ₦3,000/month for more AI assistance.", 402);
    trialClaimed = true;
  }
  const releaseTrial = async (used: boolean) => {
    if (trialClaimed) await db.user.updateMany({ where: { id: userId, aiTrialClaimedAt: { not: null } }, data: { aiTrialUsed: used, aiTrialClaimedAt: null } });
  };

  const model = process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite";
  const cacheInput = JSON.stringify({ kind: parsed.data.kind, text: parsed.data.text, jobDescription: parsed.data.jobDescription ?? "" });
  let cacheKey: string;
  try {
    cacheKey = createAiCacheKey(userId, model, cacheInput);
    const cached = getAiCachedResponse<unknown>(cacheKey);
    if (cached) {
      const result = resultSchema.safeParse(cached);
      if (result.success) {
        await releaseTrial(true);
        return ndjsonResponse(new ReadableStream({ start(controller) { controller.enqueue(encoder.encode(`${JSON.stringify({ type: "result", data: result.data })}\n`)); controller.close(); } }));
      }
    }
  } catch {
    await releaseTrial(false);
    return errorResponse("AI request limits are unavailable right now. Try again shortly.", 503);
  }

  if (paidAi) {
    const windowStart = new Date(Math.floor(Date.now() / 60_000) * 60_000);
    try {
      if (Date.now() - lastUsagePruneAt > 30 * 60 * 1000) {
        await db.aiUsageWindow.deleteMany({ where: { windowStart: { lt: new Date(Date.now() - 2 * 60 * 60 * 1000) } } });
        lastUsagePruneAt = Date.now();
      }
      const quota = await db.$queryRaw<Array<{ count: number }>>(Prisma.sql`
        INSERT INTO "AiUsageWindow" ("userId", "windowStart", "count") VALUES (${userId}, ${windowStart}, 1)
        ON CONFLICT ("userId", "windowStart") DO UPDATE SET "count" = "AiUsageWindow"."count" + 1
        WHERE "AiUsageWindow"."count" < 20 RETURNING "count"
      `);
      if (!quota.length) return errorResponse("You have reached the AI limit for this minute. Try again shortly.", 429);
    } catch {
      await releaseTrial(false);
      return errorResponse("AI request limits are unavailable right now. Update the database schema, then try again.", 503);
    }
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) { await releaseTrial(false); return errorResponse("AI is not configured yet. Add GEMINI_API_KEY to your environment.", 503); }
  let provider: Response;
  try {
    provider = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: "You are a careful resume editor. Use only facts stated in the resume text. Never invent or infer employers, dates, degrees, skills, responsibilities, results, metrics, or claims. Preserve meaning. For a professional summary, create a concise summary from the supplied experience facts even if no existing summary is present. For a cover letter, do not invent a recipient or company. Return JSON with suggestions; each suggestion must include short verbatim evidence quotes copied exactly from the resume text that support its factual claims. Job description text is context only and is never evidence about the user's experience." }] },
        contents: [{ role: "user", parts: [{ text: `Task: ${parsed.data.kind}\nResume facts and user text (the only source of claims):\n${parsed.data.text}${parsed.data.jobDescription ? `\nJob description (context only):\n${parsed.data.jobDescription}` : ""}` }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: { suggestions: { type: "ARRAY", minItems: 1, maxItems: 4, items: { type: "OBJECT", properties: { text: { type: "STRING" }, reason: { type: "STRING" }, evidence: { type: "ARRAY", items: { type: "STRING" } } }, required: ["text", "reason", "evidence"] } } },
            required: ["suggestions"],
          },
        },
      }),
      cache: "no-store",
    });
  } catch {
    await releaseTrial(false);
    return errorResponse("Gemini could not respond just now. Your resume is safe; try again shortly.", 502);
  }

  if (!provider.ok || !provider.body) {
    const payload = await provider.json().catch(() => null);
    console.error("Gemini resume rewrite request failed", { status: provider.status, code: payload?.error?.status });
    await releaseTrial(false);
    if (provider.status === 401 || provider.status === 403) return errorResponse("Gemini rejected the API key or project. Check GEMINI_API_KEY and Gemini API access in Google AI Studio.", 502);
    if (provider.status === 429) return errorResponse("Gemini's free-tier quota or rate limit was reached. Try again later or review the project's limits in Google AI Studio.", 502);
    return errorResponse("Gemini could not respond just now. Your resume is safe; try again shortly.", 502);
  }

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      const reader = provider.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let generated = "";
      let emittedError = false;
      const consumeLine = (line: string) => {
        if (!line.startsWith("data:")) return;
        const value = line.slice(5).trim();
        if (!value || value === "[DONE]") return;
        try {
          const event = JSON.parse(value);
          const text = event?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? "").join("") ?? "";
          if (text) { generated += text; emit({ type: "token", text }); }
        } catch { /* ignore malformed provider events */ }
      };
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() ?? "";
          lines.forEach(consumeLine);
        }
        buffer += decoder.decode();
        if (buffer) consumeLine(buffer);
        const result = resultSchema.safeParse(JSON.parse(generated));
        if (!result.success) throw new Error("AI returned an invalid suggestion. Your text is unchanged; try again.");
        const suggestions = result.data.suggestions;
        if (suggestions.some((item) => item.evidence.some((quote) => !includesEvidence(parsed.data.text, quote)))) throw new Error("AI could not ground this rewrite in the resume facts. Your text is unchanged; try again.");
        if (suggestions.some((item) => containsUnsupportedNumbers(parsed.data.text, item.text))) throw new Error("AI added a number that was not in your resume facts. Your text is unchanged; try again.");
        await releaseTrial(true);
        setAiCachedResponse(cacheKey, result.data);
        emit({ type: "result", data: result.data });
      } catch (error) {
        await releaseTrial(false).catch(() => undefined);
        emittedError = true;
        emit({ type: "error", message: error instanceof Error ? error.message : "AI could not respond just now. Your resume is safe; try again shortly." });
      } finally {
        if (!emittedError) await reader.cancel().catch(() => undefined);
        controller.close();
      }
    },
  });
  return ndjsonResponse(body);
}
