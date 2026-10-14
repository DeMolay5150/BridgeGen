import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultSnapshot } from "../persistence/serialize";
import { colorFor, cursorSchema, displayName, peersFromPresence, stateSchema, throttle, topicFor } from "./protocol";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const ME = "33333333-3333-4333-8333-333333333333";

describe("realtime protocol", () => {
  it("names the private channel the way the RLS policy expects", () => {
    expect(topicFor(A)).toBe(`company:${A}`);
    expect(topicFor(A)).toMatch(/^company:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("turns an email into a display name", () => {
    expect(displayName("jordan.lee@meridian.com")).toBe("Jordan Lee");
    expect(displayName("sam_o-neil+bridgegen@x.io")).toBe("Sam O Neil Bridgegen");
    expect(displayName(undefined)).toBe("Colleague");
  });

  it("gives each person a stable theme colour", () => {
    expect(colorFor(A)).toBe(colorFor(A));
    expect(colorFor(A)).toMatch(/^var\(--/);
  });

  it("lists colleagues once each, without the viewer or malformed entries", () => {
    const state = {
      [A]: [
        { userId: A, name: "Alex", color: "var(--metric)", view: "map" },
        { userId: A, name: "Alex", color: "var(--metric)", view: "facilitator" },
      ],
      [ME]: [{ userId: ME, name: "Me", color: "x", view: "map" }],
      [B]: [{ userId: B, name: "Blair", color: "x", view: "board" }],
      junk: [{ userId: "not-a-uuid", name: "?", color: "x", view: "map" }, { name: "<script>" }],
    };
    expect(peersFromPresence(state, ME)).toEqual([
      { userId: A, name: "Alex", color: "var(--metric)", view: "facilitator" },
      { userId: B, name: "Blair", color: "x", view: "board" },
    ]);
  });

  it("rejects cursors off the surface or on unknown views", () => {
    expect(cursorSchema.safeParse({ userId: A, x: 0.5, y: 0.2, view: "map" }).success).toBe(true);
    expect(cursorSchema.safeParse({ userId: A, x: 1.5, y: 0.2, view: "map" }).success).toBe(false);
    expect(cursorSchema.safeParse({ userId: A, x: 0.5, y: 0.2, view: "admin" }).success).toBe(false);
  });

  it("accepts a colleague's decision inputs but nothing malformed", () => {
    const { baseline, scenario, governance, priorities } = defaultSnapshot();
    expect(stateSchema.safeParse({ userId: A, baseline, scenario, governance, priorities }).success).toBe(true);
    expect(stateSchema.safeParse({ userId: A, baseline: { revenue: "lots" }, scenario, governance, priorities }).success).toBe(false);
    expect(stateSchema.safeParse({ userId: A, baseline, scenario: { leverage: Infinity }, governance, priorities }).success).toBe(false);
  });
});

describe("throttle", () => {
  afterEach(() => vi.useRealTimers());

  it("fires at most once per window and always delivers the latest value", () => {
    vi.useFakeTimers();
    const calls: number[] = [];
    const send = throttle((n: number) => calls.push(n), 100);
    send(1);
    send(2);
    send(3);
    expect(calls).toEqual([1]);
    vi.advanceTimersByTime(100);
    expect(calls).toEqual([1, 3]);
    send(4);
    send.cancel();
    vi.advanceTimersByTime(200);
    expect(calls).toEqual([1, 3]);
  });
});
