import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import type { NextRequest } from "next/server";

/** Budgets per sliding 10-minute window. */
const BUDGETS = {
  "respond:get:ip": 120,
  "respond:post:ip": 60,
  "respond:post:token": 30,
} as const;

export type LimitKind = keyof typeof BUDGETS;

let limiters: Map<LimitKind, Ratelimit> | null | undefined;

/** One limiter per budget, or null when Upstash isn't configured (local dev and the public demo). */
function getLimiters(): Map<LimitKind, Ratelimit> | null {
  if (limiters !== undefined) return limiters;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return (limiters = null);
  const redis = new Redis({ url, token });
  limiters = new Map(
    (Object.keys(BUDGETS) as LimitKind[]).map((kind) => [
      kind,
      // Fails open after 1s: an Upstash outage must not lock stakeholders out.
      new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(BUDGETS[kind], "10 m"), prefix: `bridgegen:${kind}`, timeout: 1000 }),
    ]),
  );
  return limiters;
}

/** The caller's IP as Vercel reports it (first x-forwarded-for hop), or "unknown". */
export function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}

/** Seconds to wait when over budget, or null when the request may proceed. */
export async function overLimit(kind: LimitKind, id: string): Promise<number | null> {
  const limiter = getLimiters()?.get(kind);
  if (!limiter) return null;
  try {
    const { success, reset } = await limiter.limit(id);
    return success ? null : Math.max(1, Math.ceil((reset - Date.now()) / 1000));
  } catch {
    return null; // Fail open, as on timeout.
  }
}
