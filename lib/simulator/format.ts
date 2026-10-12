const moneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** Formats an amount in USD millions, e.g. 96 → "$96.0M", 1250 → "$1.3B". */
export function formatMoney(millions: number): string {
  // Compact notation drops the unit at zero; also absorbs "-$0.0" rounding noise.
  if (Math.abs(millions) < 0.0005) return "$0.0M";
  return moneyFormatter.format(millions * 1_000_000);
}

/** Formats a ratio as a multiple, e.g. 8 → "8.0x". Null renders as "n/a". */
export function formatMultiple(value: number | null): string {
  return value === null ? "n/a" : `${value.toFixed(1)}x`;
}

/** Formats a fraction as a percentage, e.g. 0.8 → "80%". */
export function formatPercent(fraction: number, digits = 0): string {
  return `${(fraction * 100).toFixed(digits)}%`;
}

/** Formats a signed fraction, e.g. -0.2 → "−20%", 0.1 → "+10%". */
export function formatSignedPercent(fraction: number): string {
  const rounded = Math.round(fraction * 100);
  if (rounded === 0) return "0%";
  return rounded > 0 ? `+${rounded}%` : `−${Math.abs(rounded)}%`;
}
