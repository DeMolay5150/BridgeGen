"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VIEW_IDS, type ViewId } from "@/lib/realtime/protocol";
import { STAKEHOLDER_IDS, STAKEHOLDER_LABELS } from "@/lib/simulator/alignment";
import { FacilitatorView } from "./facilitator-view";
import { LiveCursors, PresenceBar } from "./live-presence";
import { RoomMap } from "./room-map";
import { StakeholderView } from "./stakeholder-view";
import { useLiveRoom } from "./use-live-room";

const isView = (value: unknown): value is ViewId => VIEW_IDS.includes(value as ViewId);

export function DecisionRoom() {
  const [view, setView] = useState<ViewId>("founder");
  const live = useLiveRoom(view);

  return (
    <div className="grid gap-8">
      <header className="grid gap-2">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="grid gap-2">
            <p className="font-mono text-xs uppercase tracking-widest text-metric">Decision Room</p>
            <h1 className="font-heading text-2xl font-semibold tracking-tight text-white md:text-3xl">
              Every seat at the table, one decision
            </h1>
          </div>
          <PresenceBar status={live.status} peers={live.peers} />
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Pass the device around. Each stakeholder sets their priorities and answers privately; the
          facilitator sees where the family disagrees and where they misread each other.
        </p>
      </header>

      <LiveCursors view={view} cursors={live.cursors} peers={live.peers} onMove={live.moveCursor}>
        {/*
          Only the selected panel's content is rendered, so one stakeholder's answers are never in
          another's view. Explicit rather than relying on Base UI's exit transition, which only
          unmounts once animation frames run (not in background tabs).
        */}
        <Tabs value={view} onValueChange={(next) => isView(next) && setView(next)} className="gap-6">
          <div className="overflow-x-auto overflow-y-hidden">
            <TabsList>
              {STAKEHOLDER_IDS.map((id) => (
                <TabsTrigger key={id} value={id} className="px-3">
                  {STAKEHOLDER_LABELS[id]}
                </TabsTrigger>
              ))}
              <TabsTrigger value="facilitator" className="px-3">
                Facilitator
              </TabsTrigger>
              <TabsTrigger value="map" className="px-3">
                Map
              </TabsTrigger>
            </TabsList>
          </div>
          {STAKEHOLDER_IDS.map((id) => (
            <TabsContent key={id} value={id}>
              {view === id && <StakeholderView stakeholder={id} />}
            </TabsContent>
          ))}
          <TabsContent value="facilitator">{view === "facilitator" && <FacilitatorView />}</TabsContent>
          <TabsContent value="map">{view === "map" && <RoomMap />}</TabsContent>
        </Tabs>
      </LiveCursors>
    </div>
  );
}
