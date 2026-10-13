import { z } from "zod";
import { DEMO_GOVERNANCE } from "../governance/model";
import type { GovernanceAnswers } from "../governance/types";
import { DEFAULT_ASSUMPTIONS } from "../projection/model";
import type { ForkState } from "../projection/types";
import { DEFAULT_PRIORITIES, PRIORITY_KEYS, STAKEHOLDER_IDS, type Priorities } from "../simulator/alignment";
import { DEMO_BASELINE, neutralScenario } from "../simulator/defaults";
import type { Baseline, Scenario } from "../simulator/types";

/** Everything about a company that is saved. Mirrors the jsonb columns of `companies`. */
export interface CompanySnapshot {
  baseline: Baseline;
  scenario: Scenario;
  governance: GovernanceAnswers;
  fork: ForkState;
  priorities: Priorities;
}

/** A `companies` row as returned by Supabase. */
export interface CompanyRow {
  id: string;
  name: string;
  baseline: unknown;
  scenario: unknown;
  governance: unknown;
  fork: unknown;
  priorities: unknown;
  updated_at?: string;
}

const finite = z.number().finite();
const practice = z.enum(["yes", "partial", "no"]);
const branch = z.object({ source: z.string().max(40), fixGovernance: z.boolean() });

const baselineSchema = z
  .object({ revenue: finite, ebitda: finite, multiple: finite, existingDebt: finite, interestRate: finite, founderOwnership: finite })
  .partial();
const scenarioSchema = z
  .object({ leverage: finite, equityTransfer: finite, multipleShock: finite, outsideCeo: z.boolean(), ceoCost: finite, ceoUplift: finite })
  .partial();
const governanceSchema = z
  .object({
    delegationOfAuthority: practice,
    successionPlan: practice,
    incapacitationPlan: practice,
    boardSeatsFilled: finite,
    boardSeatsRecommended: finite,
    independentDirectors: finite,
    meetingCadence: z.enum(["quarterly", "annual", "adhoc"]),
    buySellAgreement: practice,
    votingRules: practice,
    disputeResolution: practice,
  })
  .partial();
const forkSchema = z
  .object({
    a: branch,
    b: branch,
    assumptions: z.object({ ebitdaGrowth: finite, cashConversion: finite }).partial(),
  })
  .partial();
// partialRecord: in Zod 4, z.record with enum keys requires every key to be present.
const stakeholderPrioritiesSchema = z.partialRecord(z.enum(PRIORITY_KEYS as [string, ...string[]]), finite);
const prioritiesSchema = z.partialRecord(z.enum(STAKEHOLDER_IDS as [string, ...string[]]), stakeholderPrioritiesSchema);

/** Parses one saved section; invalid data falls back to an empty patch (i.e. the defaults). */
function section<T extends object>(schema: z.ZodType<T>, value: unknown): Partial<T> {
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : {};
}

/** The demo company: the starting point for the public demo and for new companies. */
export function defaultSnapshot(): CompanySnapshot {
  return {
    baseline: DEMO_BASELINE,
    scenario: neutralScenario(DEMO_BASELINE),
    governance: DEMO_GOVERNANCE,
    fork: {
      a: { source: "today", fixGovernance: false },
      b: { source: "current", fixGovernance: false },
      assumptions: DEFAULT_ASSUMPTIONS,
    },
    priorities: DEFAULT_PRIORITIES,
  };
}

/**
 * Turns a saved row into a complete snapshot. Every section is validated and
 * merged over the defaults, so rows saved before a field existed still load.
 */
export function fromRow(
  row: Pick<CompanyRow, "baseline" | "scenario" | "governance" | "fork" | "priorities">,
): CompanySnapshot {
  const d = defaultSnapshot();
  const baseline = { ...d.baseline, ...section(baselineSchema, row.baseline) };
  const fork = section(forkSchema, row.fork);
  const priorities = section(prioritiesSchema, row.priorities) as Partial<Record<string, Partial<Priorities["founder"]>>>;
  return {
    baseline,
    scenario: { ...neutralScenario(baseline), ...section(scenarioSchema, row.scenario) },
    governance: { ...d.governance, ...section(governanceSchema, row.governance) },
    fork: {
      a: fork.a ?? d.fork.a,
      b: fork.b ?? d.fork.b,
      assumptions: { ...d.fork.assumptions, ...fork.assumptions },
    },
    priorities: Object.fromEntries(
      STAKEHOLDER_IDS.map((id) => [id, { ...d.priorities[id], ...priorities[id] }]),
    ) as Priorities,
  };
}

/** The jsonb columns to write for a snapshot. */
export function toRow(snapshot: CompanySnapshot) {
  const { baseline, scenario, governance, fork, priorities } = snapshot;
  return { baseline, scenario, governance, fork, priorities };
}
