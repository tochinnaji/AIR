import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function key() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is required to protect Paystack subscription tokens.");
  return createHash("sha256").update(secret).digest();
}

export function sealPaystackToken(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function openPaystackToken(value: string) {
  const [ivText, tagText, dataText] = value.split(".");
  if (!ivText || !tagText || !dataText) throw new Error("Stored Paystack token is invalid.");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(dataText, "base64url")), decipher.final()]).toString("utf8");
}
