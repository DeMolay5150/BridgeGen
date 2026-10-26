import type { Heir, HeirHolding, Holders } from "./types";

/** More heirs than this is a family office problem, not a simulator one. */
export const MAX_HEIRS = 6;
export const MAX_HEIR_NAME = 60;

/** The single next-generation holder every company had before heirs could be named. */
export const DEFAULT_HEIRS: Heir[] = [{ id: "heir-1", name: "Next generation", share: 1, active: true }];

/** Shares within this of each other count as equal. */
const TIE = 0.005;

/**
 * A safe heir list: at most MAX_HEIRS, trimmed names, and shares of the
 * transferred stake that are finite, non-negative and sum to 1 (an equal
 * split when none are set). Missing or empty means the single default heir,
 * so companies saved before heirs existed simulate exactly as they did.
 */
export function normalizeHeirs(heirs: readonly Heir[] | undefined): Heir[] {
  const list = (heirs ?? []).slice(0, MAX_HEIRS);
  if (list.length === 0) return DEFAULT_HEIRS;
  const shares = list.map((h) => (Number.isFinite(h.share) && h.share > 0 ? h.share : 0));
  const total = shares.reduce((sum, s) => sum + s, 0);
  return list.map((h, i) => ({
    id: String(h.id).slice(0, 40) || `heir-${i + 1}`,
    name: String(h.name).trim().slice(0, MAX_HEIR_NAME) || `Heir ${i + 1}`,
    share: total > 0 ? shares[i] / total : 1 / list.length,
    active: h.active === true,
  }));
}

/** Each heir's slice of the next generation's ownership, equity and recap cash. */
export function heirHoldings(
  heirs: readonly Heir[],
  ownership: Holders,
  holderEquity: Holders,
  holderDistribution: Holders,
): HeirHolding[] {
  return heirs.map((h) => ({
    ...h,
    ownership: ownership.nextGen * h.share,
    equity: holderEquity.nextGen * h.share,
    distribution: holderDistribution.nextGen * h.share,
  }));
}

const byOwnership = (a: HeirHolding, b: HeirHolding) => b.ownership - a.ownership;

/** The heir most likely to walk away from a role: the largest active one, else the largest. */
export function departingHeir(holdings: readonly HeirHolding[]): HeirHolding | null {
  const holding = holdings.filter((h) => h.ownership > 0);
  const active = holding.filter((h) => h.active);
  return [...(active.length ? active : holding)].sort(byOwnership)[0] ?? null;
}

/** The two largest heirs when they hold equal stakes and neither has a majority of the heirs' shares. */
export function heirDeadlock(holdings: readonly HeirHolding[]): [HeirHolding, HeirHolding] | null {
  const [first, second] = holdings.filter((h) => h.ownership > 0).sort(byOwnership);
  if (!first || !second) return null;
  return first.share - second.share < TIE && first.share <= 0.5 + TIE ? [first, second] : null;
}

/** True when the list is just the default single heir (copy then reads as before heirs existed). */
export const isSingleDefaultHeir = (heirs: readonly Heir[]) =>
  heirs.length === 1 && heirs[0].name === DEFAULT_HEIRS[0].name;
