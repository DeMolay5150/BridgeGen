import { describe, expect, it } from "vitest";
import { inviteBodySchema, responseBodySchema, tokenSchema } from "./schema";
import { generateToken, hashToken } from "./tokens";

describe("room request validation", () => {
  it("accepts a valid response", () => {
    const body = { positions: { nextGenReady: 4, outsideCeo: 1 }, predictions: {}, submitted: false };
    expect(responseBodySchema.safeParse(body).success).toBe(true);
  });

  it("rejects ratings outside 1–5 and non-integers", () => {
    for (const rating of [0, 6, 2.5, "3", null]) {
      const body = { positions: { nextGenReady: rating }, predictions: {}, submitted: false };
      expect(responseBodySchema.safeParse(body).success).toBe(false);
    }
  });

  it("rejects unknown topics instead of silently storing them", () => {
    const body = { positions: { favouriteColour: 3 }, predictions: {}, submitted: true };
    expect(responseBodySchema.safeParse(body).success).toBe(false);
  });

  it("only accepts the four stakeholders", () => {
    expect(inviteBodySchema.safeParse({ stakeholder: "board" }).success).toBe(true);
    expect(inviteBodySchema.safeParse({ stakeholder: "advisor" }).success).toBe(false);
  });
});

describe("invite tokens", () => {
  it("generates 32 random bytes as 43 URL-safe characters", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
    expect(tokenSchema.safeParse(a).success).toBe(true);
    expect(Buffer.from(a, "base64url")).toHaveLength(32);
  });

  it("hashes deterministically to 64 hex characters", () => {
    const token = generateToken();
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(token)).not.toBe(hashToken(generateToken()));
  });

  it("rejects malformed tokens before any database lookup", () => {
    for (const bad of ["", "short", `${generateToken()}x`, "a".repeat(42) + "!", "../../etc/passwd"]) {
      expect(tokenSchema.safeParse(bad).success).toBe(false);
    }
  });
});
