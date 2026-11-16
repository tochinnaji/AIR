import { createHmac } from "node:crypto";

const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_ENTRIES = 2000;
const responses = new Map<string, { value: unknown; expiresAt: number }>();

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET is required to isolate cached AI responses.");
  return value;
}

export function createAiCacheKey(userId: string, model: string, input: string) {
  return createHmac("sha256", secret()).update(JSON.stringify({ userId, model, input })).digest("hex");
}

export function getAiCachedResponse<T>(key: string): T | null {
  const entry = responses.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) { responses.delete(key); return null; }
  responses.delete(key);
  responses.set(key, entry);
  return entry.value as T;
}

export function setAiCachedResponse(key: string, value: unknown) {
  if (responses.size >= MAX_CACHE_ENTRIES && !responses.has(key)) {
    const oldestKey = responses.keys().next().value;
    if (oldestKey) responses.delete(oldestKey);
  }
  responses.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}
