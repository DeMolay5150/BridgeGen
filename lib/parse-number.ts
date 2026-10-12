/** Accepts pasted values like "$12,000,000" → 12000000 or "8%" → 8; null if unparseable. */
export function parseNumber(text: string): number | null {
  const cleaned = text.replace(/[$,%\sx]/gi, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}
