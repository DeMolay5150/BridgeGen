/**
 * The PDF uses the built-in Helvetica, whose WinAnsi encoding lacks a few
 * characters the app's copy relies on. Map them to safe equivalents so they
 * never render as blanks or garbage glyphs. (×, ·, –, …, “ ” are in WinAnsi.)
 */
const REPLACEMENTS: [RegExp, string][] = [
  [/\u2212/g, "-"], // minus sign
  [/\u2192/g, "->"], // right arrow
  [/\u2265/g, ">="],
  [/\u2264/g, "<="],
  [/\u2011/g, "-"], // non-breaking hyphen
  [/[\u00a0\u202f]/g, " "], // no-break spaces from Intl formatting
];

export function pdfText(text: string): string {
  return REPLACEMENTS.reduce((out, [pattern, replacement]) => out.replace(pattern, replacement), text);
}
