import { describe, expect, it } from "vitest";
import { BEST_PRACTICE_GOVERNANCE, DEMO_GOVERNANCE } from "../governance/model";
import { DEMO_BASELINE, neutralScenario } from "../simulator/defaults";
import { simulate } from "../simulator/engine";
import { NEXT_PRACTICE, governanceGraph, ownershipGraph } from "./map";

const neutral = neutralScenario(DEMO_BASELINE);

describe("ownership map", () => {
  it("cascades the demo company's equity to its holders", () => {
    const g = ownershipGraph(simulate(DEMO_BASELINE, neutral));
    const node = (id: string) => g.nodes.find((n) => n.id === id)!;
    expect(node("founder").lines).toEqual(["80% of equity", "$72.0M"]);
    expect(node("nextGen").tone).toBe("neutral");
    expect(node("company").lines[0]).toBe("$96.0M");
    // No edge for a holder with no stake.
    expect(g.edges.map((e) => e.id)).not.toContain("nextGen-equity");
  });

  it("moves value to the heir and adds lender pressure as the decision changes", () => {
    const g = ownershipGraph(simulate(DEMO_BASELINE, { ...neutral, equityTransfer: 0.5, leverage: 6, multipleShock: -0.4 }));
    const node = (id: string) => g.nodes.find((n) => n.id === id)!;
    expect(node("nextGen").lines[0]).toBe("40% of equity");
    // $72M at 8% against $12M EBITDA: 2.1x coverage, inside the caution band.
    expect(node("lenders")).toMatchObject({ tone: "caution", lines: ["$72.0M", "Coverage 2.1x"] });
    expect(node("equity").lines[1]).toBe("Underwater");
    expect(g.edges.find((e) => e.id === "equity-company")?.tone).toBe("critical");
  });

  it("connects every edge to a real node", () => {
    for (const g of [ownershipGraph(simulate(DEMO_BASELINE, neutral)), governanceGraph(DEMO_GOVERNANCE)]) {
      const ids = new Set(g.nodes.map((n) => n.id));
      g.edges.forEach((e) => expect(ids.has(e.source) && ids.has(e.target)).toBe(true));
    }
  });
});

describe("governance map", () => {
  it("colours each practice by its answer and flags the thin demo board", () => {
    const g = governanceGraph(DEMO_GOVERNANCE);
    const node = (id: string) => g.nodes.find((n) => n.id === id)!;
    expect(node("delegationOfAuthority")).toMatchObject({ tone: "critical", practice: "delegationOfAuthority" });
    expect(node("successionPlan").tone).toBe("caution");
    expect(node("board").lines[0]).toBe("2 of 5 seats filled");
    expect(node("shareholders").lines[0]).toBe("Governance debt 78/100");
  });

  it("goes green at best practice", () => {
    const g = governanceGraph(BEST_PRACTICE_GOVERNANCE);
    g.nodes.filter((n) => n.practice || n.id === "board").forEach((n) => expect(n.tone).toBe("positive"));
  });

  it("cycles a practice through every answer", () => {
    expect([NEXT_PRACTICE.yes, NEXT_PRACTICE.partial, NEXT_PRACTICE.no]).toEqual(["partial", "no", "yes"]);
  });
});
