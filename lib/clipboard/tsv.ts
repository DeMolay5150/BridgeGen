import { parseNumber } from "../parse-number";
import type { BaselineFigures } from "../simulator/types";

/*
 * Spreadsheet clipboard interop. Excel, Google Sheets and Numbers all copy
 * and paste tab-separated rows, so TSV is the whole protocol.
 */

/** Rows of cells → TSV. Numbers are written raw (full precision) so the spreadsheet can compute with them. */
export function toTsv(rows: (string | number | null)[][]): string {
  const cell = (v: string | number | null) =>
    v === null ? "" : typeof v === "number" ? String(Math.round(v * 1_000_000) / 1_000_000) : v.replace(/[\t\r\n]+/g, " ");
  return rows.map((row) => row.map(cell).join("\t")).join("\n");
}

/** TSV → trimmed cells, dropping blank rows. */
export function fromTsv(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((line) => line.split("\t").map((c) => c.trim()))
    .filter((row) => row.some((c) => c !== ""));
}

type Unit = "money" | "multiple" | "percent";

/** Baseline fields in the order the panel shows them, with the labels a spreadsheet might use. */
const BASELINE_FIELDS: { key: keyof BaselineFigures; unit: Unit; aliases: string[] }[] = [
  { key: "revenue", unit: "money", aliases: ["revenue", "sales", "turnover", "net revenue"] },
  { key: "ebitda", unit: "money", aliases: ["ebitda", "adjusted ebitda"] },
  { key: "multiple", unit: "multiple", aliases: ["ebitda multiple", "multiple", "ev/ebitda", "ev / ebitda"] },
  { key: "existingDebt", unit: "money", aliases: ["existing debt", "debt", "total debt", "net debt"] },
  { key: "interestRate", unit: "percent", aliases: ["interest rate", "rate", "cost of debt"] },
  { key: "founderOwnership", unit: "percent", aliases: ["founder ownership", "founder %", "founder stake", "ownership"] },
];

/** Converts a pasted cell to the baseline's units: $ millions, multiples, fractions. */
function toUnit(text: string, unit: Unit): number | null {
  const value = parseNumber(text);
  if (value === null) return null;
  if (unit === "percent") return text.includes("%") || Math.abs(value) > 1 ? value / 100 : value;
  // Whole-dollar figures ("$40,000,000") arrive far above any $M figure.
  if (unit === "money") return Math.abs(value) >= 100_000 ? value / 1_000_000 : value;
  return value;
}

/** "Revenue ($M)" → "revenue"; "Interest rate (%)" → "interest rate". */
const normalizeLabel = (label: string) =>
  label
    .toLowerCase()
    .replace(/\(\s*(\$\s*m|\$|%|x|usd\s*m)\s*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Reads a block copied from a spreadsheet into baseline fields. Accepts
 * label/value pairs in any order ("Revenue  40") or bare numbers in the
 * panel's order, as a row or a column. Returns null when nothing matches.
 */
export function parseBaselinePaste(text: string): Partial<BaselineFigures> | null {
  const rows = fromTsv(text);
  const out: Partial<BaselineFigures> = {};

  const labelled = rows.filter((r) => r.length >= 2 && parseNumber(r[0]) === null);
  if (labelled.length > 0) {
    for (const [label, raw] of labelled) {
      const field = BASELINE_FIELDS.find((f) => f.aliases.includes(normalizeLabel(label)));
      const value = field ? toUnit(raw, field.unit) : null;
      if (field && value !== null) out[field.key] = value;
    }
  } else {
    const cells = rows.flat().filter((c) => c !== "");
    cells.slice(0, BASELINE_FIELDS.length).forEach((raw, i) => {
      const value = toUnit(raw, BASELINE_FIELDS[i].unit);
      if (value !== null) out[BASELINE_FIELDS[i].key] = value;
    });
  }
  return Object.keys(out).length > 0 ? out : null;
}
