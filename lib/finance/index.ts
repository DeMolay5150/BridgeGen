/**
 * Standard corporate-finance primitives, in one place so every module prices
 * time the same way. Conventions:
 * - Cash-flow arrays start at t = 0, which is NOT discounted (unlike Excel's
 *   NPV(), which discounts its first value; use `npv(r, [0, ...flows])` to match it).
 * - Rates are fractions per period (0.08 = 8%).
 * - XIRR uses Actual/365, as Excel does.
 * - Functions that can't produce an answer return null rather than NaN.
 */

/** Net present value of flows at t = 0, 1, 2, … */
export function npv(rate: number, flows: number[]): number {
  return flows.reduce((sum, flow, t) => sum + flow / (1 + rate) ** t, 0);
}

/** d/dr of npv, for Newton's method. */
function npvSlope(rate: number, flows: number[]): number {
  return flows.reduce((sum, flow, t) => sum - (t * flow) / (1 + rate) ** (t + 1), 0);
}

const hasSignChange = (values: number[]) => values.some((v) => v > 0) && values.some((v) => v < 0);

/**
 * Finds a root of `f` near `guess`: Newton's method first, then bisection on
 * a bracket if Newton wanders. Rates are searched in (−99.99%, 10000%).
 */
function solveRate(f: (r: number) => number, slope: (r: number) => number, guess: number): number | null {
  const LOW = -0.9999;
  const HIGH = 100;
  const TOLERANCE = 1e-10;

  let r = guess;
  for (let i = 0; i < 50; i++) {
    const value = f(r);
    if (Math.abs(value) < TOLERANCE) return r;
    const d = slope(r);
    if (!Number.isFinite(d) || d === 0) break;
    const next = r - value / d;
    if (!Number.isFinite(next) || next <= LOW || next >= HIGH) break;
    if (Math.abs(next - r) < TOLERANCE) return next;
    r = next;
  }

  // Bisection: scan for a sign change, then narrow it down.
  let lo = LOW;
  let fLo = f(lo);
  for (const hi of [-0.5, 0, 0.1, 0.25, 0.5, 1, 2, 5, 10, 25, HIGH]) {
    const fHi = f(hi);
    if (Number.isFinite(fLo) && Number.isFinite(fHi) && fLo * fHi <= 0) {
      let a = lo;
      let b = hi;
      let fa = fLo;
      for (let i = 0; i < 200; i++) {
        const mid = (a + b) / 2;
        const fm = f(mid);
        if (Math.abs(fm) < TOLERANCE || b - a < TOLERANCE) return mid;
        if (fa * fm < 0) b = mid;
        else {
          a = mid;
          fa = fm;
        }
      }
      return (a + b) / 2;
    }
    lo = hi;
    fLo = fHi;
  }
  return null;
}

/** Internal rate of return of periodic flows; null when flows never change sign. */
export function irr(flows: number[], guess = 0.1): number | null {
  if (!hasSignChange(flows)) return null;
  return solveRate((r) => npv(r, flows), (r) => npvSlope(r, flows), guess);
}

export interface DatedFlow {
  amount: number;
  date: Date;
}

const DAY_MS = 86_400_000;

/** Present value of dated flows at `rate`, Actual/365 from the earliest date. */
export function xnpv(rate: number, flows: DatedFlow[]): number {
  if (flows.length === 0) return 0;
  const start = Math.min(...flows.map((f) => f.date.getTime()));
  return flows.reduce((sum, f) => sum + f.amount / (1 + rate) ** ((f.date.getTime() - start) / DAY_MS / 365), 0);
}

/** IRR of irregularly dated flows (Excel XIRR); null when flows never change sign. */
export function xirr(flows: DatedFlow[], guess = 0.1): number | null {
  if (!hasSignChange(flows.map((f) => f.amount))) return null;
  const start = Math.min(...flows.map((f) => f.date.getTime()));
  const years = flows.map((f) => (f.date.getTime() - start) / DAY_MS / 365);
  const slope = (r: number) => flows.reduce((sum, f, i) => sum - (years[i] * f.amount) / (1 + r) ** (years[i] + 1), 0);
  return solveRate((r) => xnpv(r, flows), slope, guess);
}

export interface WaccInputs {
  /** Market value of equity. */
  equity: number;
  /** Market value of debt. */
  debt: number;
  costOfEquity: number;
  /** Pre-tax cost of debt. */
  costOfDebt: number;
  taxRate: number;
}

/** Weighted average cost of capital, with the interest tax shield. Null when there's no capital. */
export function wacc({ equity, debt, costOfEquity, costOfDebt, taxRate }: WaccInputs): number | null {
  const e = Math.max(equity, 0);
  const d = Math.max(debt, 0);
  const total = e + d;
  if (total <= 0) return null;
  return (e / total) * costOfEquity + (d / total) * costOfDebt * (1 - taxRate);
}

/** Level payment that repays `principal` over `periods` at `rate` per period (Excel PMT, as a positive number). */
export function pmt(rate: number, periods: number, principal: number): number {
  if (periods <= 0) return principal;
  if (rate === 0) return principal / periods;
  return (principal * rate) / (1 - (1 + rate) ** -periods);
}

export type AmortizationStyle = "level" | "straightLine" | "bullet";

export interface AmortizationRow {
  period: number;
  openingBalance: number;
  interest: number;
  principal: number;
  payment: number;
  closingBalance: number;
}

/**
 * Debt schedule. `level`: equal total payments (mortgage-style);
 * `straightLine`: equal principal; `bullet`: interest only, principal at maturity.
 */
export function amortize(principal: number, rate: number, periods: number, style: AmortizationStyle): AmortizationRow[] {
  const rows: AmortizationRow[] = [];
  const n = Math.max(Math.round(periods), 0);
  const level = pmt(rate, n, principal);
  let balance = Math.max(principal, 0);
  for (let period = 1; period <= n; period++) {
    const interest = balance * rate;
    const due =
      style === "level" ? level - interest : style === "straightLine" ? principal / n : period === n ? balance : 0;
    // The last period clears any rounding residue.
    const repaid = period === n ? balance : Math.min(Math.max(due, 0), balance);
    rows.push({
      period,
      openingBalance: balance,
      interest,
      principal: repaid,
      payment: interest + repaid,
      closingBalance: balance - repaid,
    });
    balance -= repaid;
  }
  return rows;
}
