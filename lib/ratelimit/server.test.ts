import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

const limit = vi.fn();
const constructed: { prefix: string; limiter: unknown; timeout: number }[] = [];
vi.mock("@upstash/redis", () => ({ Redis: class {} }));
vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class {
    static slidingWindow = (tokens: number, window: string) => ({ tokens, window });
    constructor(options: { prefix: string; limiter: unknown; timeout: number }) {
      constructed.push(options);
    }
    limit = limit;
  },
}));

/** A fresh module per test: the limiters are cached on first use. */
async function load() {
  vi.resetModules();
  return import("./server");
}

const configure = () => {
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");
};

beforeEach(() => {
  limit.mockReset();
  constructed.length = 0;
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("overLimit", () => {
  it("never limits when Upstash isn't configured", async () => {
    const { overLimit } = await load();
    expect(await overLimit("respond:post:ip", "1.2.3.4")).toBeNull();
    expect(constructed).toHaveLength(0);
    expect(limit).not.toHaveBeenCalled();
  });

  it("needs both the URL and the token", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    const { overLimit } = await load();
    expect(await overLimit("respond:get:ip", "1.2.3.4")).toBeNull();
    expect(constructed).toHaveLength(0);
  });

  it("builds one 10-minute sliding window per budget, failing open after 1s", async () => {
    configure();
    const { overLimit } = await load();
    limit.mockResolvedValue({ success: true, reset: Date.now() });
    await overLimit("respond:get:ip", "x");
    expect(constructed).toEqual([
      { redis: expect.anything(), limiter: { tokens: 120, window: "10 m" }, prefix: "bridgegen:respond:get:ip", timeout: 1000 },
      { redis: expect.anything(), limiter: { tokens: 60, window: "10 m" }, prefix: "bridgegen:respond:post:ip", timeout: 1000 },
      { redis: expect.anything(), limiter: { tokens: 30, window: "10 m" }, prefix: "bridgegen:respond:post:token", timeout: 1000 },
    ]);
    // Cached: a second call builds nothing new.
    await overLimit("respond:post:token", "y");
    expect(constructed).toHaveLength(3);
    expect(limit.mock.calls).toEqual([["x"], ["y"]]);
  });

  it("lets a request through while under budget", async () => {
    configure();
    const { overLimit } = await load();
    limit.mockResolvedValue({ success: true, reset: Date.now() + 60_000 });
    expect(await overLimit("respond:post:ip", "1.2.3.4")).toBeNull();
  });

  it("returns whole seconds until the window resets, at least 1", async () => {
    configure();
    vi.useFakeTimers({ now: 1_000_000 });
    const { overLimit } = await load();
    limit.mockResolvedValueOnce({ success: false, reset: 1_000_000 + 30_200 });
    expect(await overLimit("respond:post:ip", "1.2.3.4")).toBe(31);
    // A reset already in the past still asks the caller to wait a second.
    limit.mockResolvedValueOnce({ success: false, reset: 1_000_000 - 5_000 });
    expect(await overLimit("respond:post:ip", "1.2.3.4")).toBe(1);
  });

  it("fails open when Upstash errors", async () => {
    configure();
    const { overLimit } = await load();
    limit.mockRejectedValue(new Error("ECONNRESET"));
    expect(await overLimit("respond:post:token", "hash")).toBeNull();
  });
});

describe("clientIp", () => {
  const request = (headers: Record<string, string>) => ({ headers: new Headers(headers) }) as unknown as NextRequest;

  it("takes the first x-forwarded-for hop", async () => {
    const { clientIp } = await load();
    expect(clientIp(request({ "x-forwarded-for": " 203.0.113.7 , 10.0.0.1" }))).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip, then to unknown", async () => {
    const { clientIp } = await load();
    expect(clientIp(request({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(clientIp(request({ "x-forwarded-for": " " }))).toBe("unknown");
    expect(clientIp(request({}))).toBe("unknown");
  });
});
