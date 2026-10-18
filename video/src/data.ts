/*
 * Every figure in the walkthrough comes from here, and everything here comes
 * from the app's own engines run on the demo company (Revenue $40M, EBITDA
 * $12M, 8.0x, $6M debt). Nothing is typed in by hand, so the video can't
 * drift from the product: change an engine and the next render follows.
 */
import { compareLiquidity } from "../../lib/alerts/liquidity";
import { buildIcDeck } from "../../lib/deck/ic";
import { DEMO_GOVERNANCE, scoreGovernance } from "../../lib/governance/model";
import { redTeamBrief } from "../../lib/narrative/redteam";
import { roomBrief } from "../../lib/narrative/room";
import { defaultSnapshot } from "../../lib/persistence/serialize";
import { breakingPoints } from "../../lib/redteam/breaking";
import { SHOCKS, runShock } from "../../lib/redteam/shocks";
import { detectGaps } from "../../lib/room/gaps";
import { DEMO_RESPONSES } from "../../lib/room/topics";
import { DEMO_BASELINE, neutralScenario } from "../../lib/simulator/defaults";
import { simulate } from "../../lib/simulator/engine";
import type { Scenario } from "../../lib/simulator/types";
import { buildStatements, statementAssumptions } from "../../lib/statements/model";
import { runMonteCarlo } from "../../lib/statements/monte-carlo";

export const baseline = DEMO_BASELINE;
export const today = neutralScenario(baseline);
/** The decision the walkthrough models: a 4x dividend recap. */
export const RECAP_LEVERAGE = 4;
export const recap: Scenario = { ...today, leverage: RECAP_LEVERAGE };

const snapshot = { ...defaultSnapshot(), scenario: recap };
const assumptions = statementAssumptions(snapshot.fork);

export const governance = scoreGovernance(DEMO_GOVERNANCE);
/** Shot 6: documenting delegated authority. */
export const governanceFixed = scoreGovernance({ ...DEMO_GOVERNANCE, delegationOfAuthority: "yes" });

/** The simulator at any leverage, so the slider animation shows real engine output per frame. */
export const simulateAt = (leverage: number) => simulate(baseline, { ...today, leverage }, governance.score);
export const resultToday = simulateAt(today.leverage);
export const resultRecap = simulateAt(RECAP_LEVERAGE);

/** Ownership at a given equity transfer (Map shot). */
export const ownershipAt = (equityTransfer: number) => simulate(baseline, { ...recap, equityTransfer }, governance.score).ownership;

export const statements = buildStatements(baseline, recap, assumptions);
export const monteCarlo = runMonteCarlo(baseline, recap, assumptions);
export const liquidity = compareLiquidity(baseline, recap, assumptions);

export const gaps = detectGaps(DEMO_RESPONSES);
export const room = roomBrief(gaps);

const rate = baseline.interestRate;
export const shocks = SHOCKS.map((s) => runShock(baseline, recap, DEMO_GOVERNANCE, s.id));
export const redTeam = redTeamBrief(shocks, breakingPoints(resultRecap, rate), breakingPoints(simulate(baseline, today), rate));

export const deck = buildIcDeck({
  companyName: "Demo company",
  preparedBy: "BridgeGen",
  snapshot,
  gaps,
  // Fixed so every render is identical.
  generatedAt: new Date("2026-10-17T12:00:00Z"),
});
