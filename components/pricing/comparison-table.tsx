import { Check, Minus } from "lucide-react";
import { COMPARISON, PLANS, type Cell } from "@/lib/pricing/plans";

function CellValue({ cell }: { cell: Cell }) {
  if (cell === true) {
    return (
      <>
        <Check className="mx-auto size-4 text-positive" aria-hidden />
        <span className="sr-only">Included</span>
      </>
    );
  }
  if (cell === false) {
    return (
      <>
        <Minus className="mx-auto size-4 text-muted-foreground/60" aria-hidden />
        <span className="sr-only">Not included</span>
      </>
    );
  }
  if (cell === "coming-soon") return <span className="text-xs text-caution">Coming soon</span>;
  return <span>{cell}</span>;
}

/** PRICING.md Section 10.4: collapsed by default on mobile, open from md up. */
export function ComparisonTable() {
  const table = (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] text-sm">
        <caption className="sr-only">Plan comparison</caption>
        <thead>
          <tr className="border-b border-border text-left">
            <th scope="col" className="py-3 pr-4 font-normal text-muted-foreground">
              Capability
            </th>
            {PLANS.map((p) => (
              <th key={p.id} scope="col" className="px-3 py-3 text-center font-medium">
                {p.id === "enterprise" ? "Enterprise" : p.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {COMPARISON.map((row) => (
            <tr key={row.capability} className="border-b border-border/60">
              <th scope="row" className="py-3 pr-4 text-left font-normal">
                {row.capability}
              </th>
              {PLANS.map((p) => (
                <td key={p.id} className="px-3 py-3 text-center text-muted-foreground">
                  <CellValue cell={row.cells[p.id]} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <details className="group rounded-xl border border-border md:hidden">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium">Compare all features</summary>
        <div className="px-4 pb-4">{table}</div>
      </details>
      <div className="hidden md:block">{table}</div>
    </>
  );
}
