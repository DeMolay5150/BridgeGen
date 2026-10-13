"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { STAKEHOLDER_IDS, STAKEHOLDER_LABELS } from "@/lib/simulator/alignment";
import { FacilitatorView } from "./facilitator-view";
import { StakeholderView } from "./stakeholder-view";

export function DecisionRoom() {
  return (
    <div className="grid gap-8">
      <header className="grid gap-2">
        <p className="font-mono text-xs uppercase tracking-widest text-metric">Decision Room</p>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-white md:text-3xl">
          Every seat at the table, one decision
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Pass the device around. Each stakeholder sets their priorities and answers privately; the
          facilitator sees where the family disagrees and where they misread each other.
        </p>
      </header>

      {/* Inactive panels unmount, so one stakeholder's answers are never in another's view. */}
      <Tabs defaultValue="founder" className="gap-6">
        <div className="overflow-x-auto">
          <TabsList>
            {STAKEHOLDER_IDS.map((id) => (
              <TabsTrigger key={id} value={id} className="px-3">
                {STAKEHOLDER_LABELS[id]}
              </TabsTrigger>
            ))}
            <TabsTrigger value="facilitator" className="px-3">
              Facilitator
            </TabsTrigger>
          </TabsList>
        </div>
        {STAKEHOLDER_IDS.map((id) => (
          <TabsContent key={id} value={id}>
            <StakeholderView stakeholder={id} />
          </TabsContent>
        ))}
        <TabsContent value="facilitator">
          <FacilitatorView />
        </TabsContent>
      </Tabs>
    </div>
  );
}
