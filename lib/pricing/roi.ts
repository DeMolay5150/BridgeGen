import { PLANS, type PlanId } from "./plans";

export interface RoiInput {
  /** Advisor's fee per owner engagement, USD. */
  feePerEngagement: number;
  /** Extra engagements won or kept per year thanks to BridgeGen. */
  extraEngagements: number;
  plan: PlanId;
}

export interface RoiResult {
  /** Annual plan price, USD (annual billing; Enterprise "from" price). */
  annualPrice: number;
  /** fee × engagements, USD per year. */
  annualUpside: number;
  /** Upside ÷ price; null when there is no upside to compare. */
  returnMultiple: number | null;
  /** Engagements needed to cover the price; null when the fee is zero. */
  breakEvenEngagements: number | null;
}

const MAX_FEE = 10_000_000;
const MAX_ENGAGEMENTS = 1_000;

const clamp = (n: number, max: number) => (Number.isFinite(n) ? Math.min(Math.max(n, 0), max) : 0);

/** PRICING.md Section 7.4: return multiple and break-even for one plan. */
export function computeRoi({ feePerEngagement, extraEngagements, plan }: RoiInput): RoiResult {
  const fee = clamp(feePerEngagement, MAX_FEE);
  const engagements = clamp(extraEngagements, MAX_ENGAGEMENTS);
  const annualPrice = PLANS.find((p) => p.id === plan)!.annual;
  const annualUpside = fee * engagements;
  return {
    annualPrice,
    annualUpside,
    returnMultiple: annualUpside > 0 ? annualUpside / annualPrice : null,
    breakEvenEngagements: fee > 0 ? annualPrice / fee : null,
  };
}
