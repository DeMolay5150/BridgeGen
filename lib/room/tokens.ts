import { createHash, randomBytes } from "node:crypto";

/** A fresh invite token: 32 random bytes, base64url (URL-safe, 43 characters). */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/** What is stored instead of the token: its SHA-256, hex-encoded (64 characters). */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
