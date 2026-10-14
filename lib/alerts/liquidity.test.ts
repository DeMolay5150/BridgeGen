import { describe, expect, it } from "vitest";
import { DEMO_BASELINE, neutralScenario } from "../simulator/defaults";
import { DEFAULT_STATEMENT_ASSUMPTIONS, buildStatements } from "../statements/model";
import { compareLiquidity, liquidityAlerts } from "./liquidity";

const base = DEMO_BASELINE;
const neutral = neutralScenario(base);
const assumptions = { ...DEFAULT_STATEMENT_ASSUMPTIONS, revenueGrowth: 0.04 };
const kinds = (s: { alerts: { kind: string }[] }) => s.alerts.map((a) => a.kind);

describe("liquidity alerts", () => {
  it("finds nothing wrong with today's lightly levered demo company, even in a downturn", () => {
    const c = compareLiquidity(base, neutral, assumptions);
    expect(c.today.base).toMatchObject({ alerts: [], severity: "positive" });
    expect(c.today.downturn.alerts).toEqual([]);
  });

  it("flags the 4x recap's early-year revolver draws and repayment gap", () => {
    // FCF of $5.2M, $5.8M, $6.5M against $6.9M of scheduled repayment a year.
    const alerts = liquidityAlerts(buildStatements(base, { ...neutral, leverage: 4 }, assumptions));
    expect(alerts.map((a) => [a.kind, a.years])).toEqual([
      ["liquidityCrunch", [1, 2, 3]],
      ["cashFlowGap", [1, 2, 3]],
    ]);
    expect(alerts[0].detail).toBe("Cash runs short: $3.4M drawn on the revolver in years 1, 2, 3 to meet scheduled repayments.");
    // Coverage of 3.25x clears the 3.0x watch line, so no covenant alert.
    expect(alerts.some((a) => a.kind.startsWith("covenant"))).toBe(false);
  });

  it("makes the downturn worse than the base case for a levered scenario", () => {
    const c = compareLiquidity(base, { ...neutral, leverage: 5 }, assumptions);
    expect(kinds(c.scenario.downturn)).toContain("covenantBreach");
    expect(c.scenario.downturn.worstFreeCashFlow).toBeLessThan(c.scenario.base.worstFreeCashFlow);
    expect(c.scenario.downturn.severity).toBe("critical");
  });

  it("flags a loss-making business as burning cash", () => {
    const losing = { ...base, ebitda: -2 };
    const alerts = liquidityAlerts(buildStatements(losing, neutralScenario(losing), assumptions));
    expect(alerts.map((a) => a.kind)).toEqual(expect.arrayContaining(["covenantBreach", "liquidityCrunch", "negativeCashFlow"]));
  });
});
