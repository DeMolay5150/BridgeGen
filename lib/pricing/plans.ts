/**
 * Plans, comparison and FAQ for /pricing. Single source of truth for prices
 * shown on the site; keep in step with PRICING.md (Sections 5 and 10).
 */

export type PlanId = "solo" | "firm" | "enterprise";

/** "coming-soon" items are on the roadmap, not built (PRICING.md Section 5.2). */
export type FeatureStatus = "available" | "coming-soon";

export interface PlanFeature {
  text: string;
  status: FeatureStatus;
}

export interface Plan {
  id: PlanId;
  name: string;
  audience: string;
  /** USD per month; null when the plan is quoted annually only. */
  monthly: number | null;
  /** USD per year (annual billing, or "from" price for Enterprise). */
  annual: number;
  /** Shown after the price, e.g. "for 5 seats". */
  priceNote?: string;
  isFromPrice?: boolean;
  badge?: string;
  features: PlanFeature[];
  extra?: string;
  cta: { label: string; kind: "trial" | "sales" };
}

const available = (text: string): PlanFeature => ({ text, status: "available" });
const comingSoon = (text: string): PlanFeature => ({ text, status: "coming-soon" });

export const PLANS: Plan[] = [
  {
    id: "solo",
    name: "Solo",
    audience: "For independent advisors, fractional CFOs and estate planners.",
    monthly: 249,
    annual: 2_490,
    features: [
      available("All six decision modules with Explain cards"),
      available("15 saved client companies"),
      available("3 confidential Decision Rooms at a time"),
      available("Email support"),
    ],
    cta: { label: "Start Solo trial", kind: "trial" },
  },
  {
    id: "firm",
    name: "Firm",
    audience: "For boutique M&A banks, family offices and advisory teams.",
    monthly: 699,
    annual: 6_990,
    priceNote: "for 5 seats",
    badge: "Most popular",
    features: [
      available("Everything in Solo"),
      comingSoon("Shared firm workspace"),
      available("75 client companies · 25 Decision Rooms at a time"),
      comingSoon("Branded client meeting packs"),
      available("Priority support and quarterly success reviews"),
    ],
    extra: "Additional seats $99 / month",
    cta: { label: "Talk to us about Firm", kind: "sales" },
  },
  {
    id: "enterprise",
    name: "Enterprise / White-Label",
    audience: "For private banks, multi-family offices and advisory networks.",
    monthly: null,
    annual: 24_000,
    isFromPrice: true,
    features: [
      comingSoon("Your brand, your domain"),
      comingSoon("SSO, audit log and data-residency options"),
      available("Calibration to your methodology"),
      available("Named success manager and SLA"),
    ],
    cta: { label: "Book a partnership call", kind: "sales" },
  },
];

/** A comparison cell: included, not included, coming soon, or a value. */
export type Cell = boolean | "coming-soon" | string;

export const COMPARISON: { capability: string; cells: Record<PlanId, Cell> }[] = [
  { capability: "Seats", cells: { solo: "1", firm: "5 included (+$99 / seat / month)", enterprise: "15+" } },
  { capability: "Active client companies", cells: { solo: "15", firm: "75", enterprise: "Unlimited (fair use)" } },
  { capability: "Confidential Decision Rooms at a time", cells: { solo: "3", firm: "25", enterprise: "Unlimited" } },
  { capability: "All six modules + Explain cards", cells: { solo: true, firm: true, enterprise: true } },
  { capability: "Saved companies with autosave", cells: { solo: true, firm: true, enterprise: true } },
  { capability: "Shared firm workspace", cells: { solo: false, firm: "coming-soon", enterprise: "coming-soon" } },
  { capability: "Branded client meeting packs", cells: { solo: false, firm: "coming-soon", enterprise: "coming-soon" } },
  { capability: "White-label (logo, colours, domain)", cells: { solo: false, firm: false, enterprise: "coming-soon" } },
  { capability: "SSO / SAML, audit log, data residency", cells: { solo: false, firm: false, enterprise: "coming-soon" } },
  { capability: "Calibration workshop", cells: { solo: false, firm: "Add-on", enterprise: true } },
  { capability: "Support", cells: { solo: "Email, 2 business days", firm: "Priority + quarterly review", enterprise: "Named manager, SLA" } },
];

export const FAQ: { question: string; answer: string }[] = [
  {
    question: "Can I try it without signing up?",
    answer: "Yes. Every module works with our demo company in the live demo. Sign up to save your own clients.",
  },
  {
    question: "Is BridgeGen a valuation tool?",
    answer:
      "No. It's a decision simulator that shows the direction and magnitude of consequences using transparent, adjustable rules. It doesn't provide valuation, legal, tax or investment advice.",
  },
  {
    question: "Can my clients see each other's answers?",
    answer:
      "No. Answers are private to each stakeholder and never shown to you either. The Decision Room only shows disagreements and misperceptions.",
  },
  {
    question: "What counts as an active client company?",
    answer: "A saved company you're working on. Archiving companies you're not using, to free up a slot, is coming soon.",
  },
  {
    question: "Can I change plans?",
    answer: "Yes. Upgrades take effect immediately and are prorated; downgrades apply at the next renewal.",
  },
  { question: "Do you offer annual billing?", answer: "Yes: two months free on Solo and Firm." },
  { question: "Do you white-label?", answer: "Yes, on the Enterprise / White-Label plan." },
];

/** Where sales CTAs go. Set NEXT_PUBLIC_SALES_CONTACT_URL (e.g. a mailto: or booking link). */
export function salesHref(): string {
  return process.env.NEXT_PUBLIC_SALES_CONTACT_URL || "/login";
}

export const TRIAL_HREF = "/login";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
export const formatUsd = (n: number) => usd.format(n);
