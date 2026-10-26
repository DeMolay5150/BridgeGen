import { z } from "zod";
import { DEMO_GOVERNANCE } from "../governance/model";
import type { GovernanceAnswers } from "../governance/types";
import { DEFAULT_ASSUMPTIONS } from "../projection/model";
import type { ForkState } from "../projection/types";
import { DEFAULT_PRIORITIES, PRIORITY_KEYS, STAKEHOLDER_IDS, type Priorities } from "../simulator/alignment";
import { DEMO_BASELINE, neutralScenario } from "../simulator/defaults";
import type { Baseline, Scenario } from "../simulator/types";
import { DEFAULT_STATEMENT_ASSUMPTIONS } from "../statements/model";

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

/* Section schemas are exported for any untrusted input (saved rows, realtime messages). */
const practice = z.enum(["yes", "partial", "no"]);
const branch = z.object({ source: z.string().max(40), fixGovernance: z.boolean() });

export const baselineSchema = z
  .object({ revenue: finite, ebitda: finite, multiple: finite, existingDebt: finite, interestRate: finite, founderOwnership: finite })
  .partial();
export const scenarioSchema = z
  .object({ leverage: finite, equityTransfer: finite, multipleShock: finite, outsideCeo: z.boolean(), ceoCost: finite, ceoUplift: finite })
  .partial();
export const governanceSchema = z
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
    // Older rows also carry cashConversion; Fork now reads the statements, so it is dropped.
    assumptions: z.object({ ebitdaGrowth: finite }).partial(),
    // Range-clamped by buildStatements, so only finiteness is checked here.
    statements: z
      .object({
        taxRate: finite,
        depreciation: finite,
        capex: finite,
        workingCapital: finite,
        fixedAssets: finite,
        minimumCash: finite,
        debtTermYears: finite,
        costOfEquity: finite,
      })
      .partial(),
  })
  .partial();
// partialRecord: in Zod 4, z.record with enum keys requires every key to be present.
const stakeholderPrioritiesSchema = z.partialRecord(z.enum(PRIORITY_KEYS as [string, ...string[]]), finite);
export const prioritiesSchema = z.partialRecord(z.enum(STAKEHOLDER_IDS as [string, ...string[]]), stakeholderPrioritiesSchema);

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Keeps every valid field of `value`, recursing into objects and records, so
 * one bad field falls back to its default alone instead of taking its whole
 * section (and the next autosave) with it. Undefined means nothing usable.
 */
function salvage(schema: z.ZodType, value: unknown): unknown {
  const inner = schema instanceof z.ZodOptional ? (schema.unwrap() as z.ZodType) : schema;
  if (isPlainObject(value) && (inner instanceof z.ZodObject || inner instanceof z.ZodRecord)) {
    const out: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(value)) {
      const field =
        inner instanceof z.ZodObject
          ? (inner.shape as Record<string, z.ZodType>)[key]
          : (inner.keyType as z.ZodType).safeParse(key).success
            ? (inner.valueType as z.ZodType)
            : undefined;
      const kept = field ? salvage(field, raw) : undefined;
      if (kept !== undefined) out[key] = kept;
    }
    // Objects with required fields are kept whole or not at all.
    const whole = schema.safeParse(out);
    return whole.success ? whole.data : undefined;
  }
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

/** Parses one saved section; invalid fields fall back to their defaults one by one. */
function section<T extends object>(schema: z.ZodType<T>, value: unknown): Partial<T> {
  const kept = salvage(schema, value);
  return isPlainObject(kept) ? (kept as Partial<T>) : {};
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
      statements: DEFAULT_STATEMENT_ASSUMPTIONS,
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
      statements: { ...d.fork.statements, ...fork.statements },
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
