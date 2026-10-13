import { describe, expect, it } from "vitest";
import { detectGaps } from "./gaps";
import { applyResponsePatch } from "./response";
import { responseBodySchema } from "./schema";
import { parseBody, rowsToResponses } from "./server-logic";
import { DEMO_RESPONSES } from "./topics";

describe("parseBody", () => {
  const valid = JSON.stringify({ positions: { takeCash: 2 }, predictions: {}, submitted: false });

  it("accepts a valid body", () => {
    expect(parseBody(valid, responseBodySchema)).toEqual({
      ok: true,
      data: { positions: { takeCash: 2 }, predictions: {}, submitted: false },
    });
  });

  it("refuses oversized bodies before parsing them", () => {
    const huge = JSON.stringify({ positions: {}, predictions: {}, submitted: false, padding: "x".repeat(5_000) });
    expect(parseBody(huge, responseBodySchema)).toMatchObject({ ok: false, status: 413 });
  });

  it("rejects malformed JSON and invalid shapes without echoing the input", () => {
    expect(parseBody("{not json", responseBodySchema)).toEqual({ ok: false, status: 400, error: "Invalid JSON" });
    const secret = JSON.stringify({ positions: { takeCash: 9 }, predictions: {}, submitted: false });
    const result = parseBody(secret, responseBodySchema);
    expect(result).toEqual({ ok: false, status: 400, error: "Invalid request" });
  });
});

describe("rowsToResponses", () => {
  const rows = Object.entries(DEMO_RESPONSES).map(([stakeholder, r]) => ({ stakeholder, ...r }));

  it("rebuilds responses from stored rows, matching in-memory gap detection", () => {
    expect(detectGaps(rowsToResponses(rows))).toEqual(detectGaps(DEMO_RESPONSES));
  });

  it("skips rows that fail validation instead of trusting them", () => {
    const tampered = [
      ...rows.slice(0, 2),
      { stakeholder: "advisor", positions: {}, predictions: {}, submitted: true },
      { stakeholder: "board", positions: { nextGenReady: 11 }, predictions: {}, submitted: true },
      { stakeholder: "lender", positions: {}, predictions: {}, submitted: "yes" },
    ];
    expect(Object.keys(rowsToResponses(tampered))).toEqual(["founder", "nextGen"]);
  });
});

describe("applyResponsePatch", () => {
  it("un-submits when answers change and keeps the rest", () => {
    const submitted = DEMO_RESPONSES.founder!;
    const edited = applyResponsePatch(submitted, { positions: { takeCash: 5 } });
    expect(edited.submitted).toBe(false);
    expect(edited.positions).toEqual({ ...submitted.positions, takeCash: 5 });
  });

  it("starts from an empty response", () => {
    expect(applyResponsePatch(undefined, { submitted: true })).toEqual({ positions: {}, predictions: {}, submitted: true });
  });
});
