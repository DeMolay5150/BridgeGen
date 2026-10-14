"use client";

import { useMemo } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, RefreshCw, ShieldCheck } from "lucide-react";
import { ExportDialog } from "@/components/report/export-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { detectGaps } from "@/lib/room/gaps";
import type { RoomGaps } from "@/lib/room/types";
import { useRoomGaps } from "@/lib/room/use-room-api";
import { STAKEHOLDER_IDS, STAKEHOLDER_LABELS, scoreScenario } from "@/lib/simulator/alignment";
import { selectGovernanceScore, useSimulatorStore } from "@/lib/simulator/store";
import { cn } from "@/lib/utils";

const EMPTY_GAPS: RoomGaps = detectGaps({});

const SEVERITY_STYLES = {
  caution: "text-caution bg-caution/10",
  critical: "text-critical bg-critical/10",
} as const;

export function FacilitatorView() {
  const room = useSimulatorStore((s) => s.room);
  const baseline = useSimulatorStore((s) => s.baseline);
  const scenario = useSimulatorStore((s) => s.scenario);
  const governanceScore = useSimulatorStore(selectGovernanceScore);
  const priorities = useSimulatorStore((s) => s.priorities);
  const loadDemoRoom = useSimulatorStore((s) => s.loadDemoRoom);
  const clearRoom = useSimulatorStore((s) => s.clearRoom);
  const companyId = useSimulatorStore((s) => s.companyId);
  const remote = useRoomGaps(companyId);

  // Saved company: gaps come from the server, which never sends raw answers.
  const localGaps = useMemo(() => detectGaps(room), [room]);
  const gaps = companyId ? (remote.data ?? EMPTY_GAPS) : localGaps;
  const matrix = useMemo(
    () => scoreScenario(baseline, scenario, governanceScore, priorities),
    [baseline, scenario, governanceScore, priorities],
  );
  const submittedCount = STAKEHOLDER_IDS.filter((id) => gaps.completion[id]).length;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Room status</CardTitle>
            <CardDescription>{submittedCount} of 4 stakeholders have submitted</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <ul className="grid gap-2">
              {STAKEHOLDER_IDS.map((id) => (
                <li key={id} className="flex items-center gap-2 text-sm">
                  {gaps.completion[id] ? (
                    <CheckCircle2 className="size-4 text-positive" aria-hidden />
                  ) : (
                    <Circle className="size-4 text-muted-foreground" aria-hidden />
                  )}
                  {STAKEHOLDER_LABELS[id]}
                  <span className="sr-only">{gaps.completion[id] ? "submitted" : "not yet submitted"}</span>
                </li>
              ))}
            </ul>
            {companyId ? (
              <>
                <Button variant="outline" size="sm" className="w-fit" onClick={remote.refresh}>
                  <RefreshCw data-icon="inline-start" />
                  Refresh
                </Button>
                {remote.error && (
                  <p role="alert" className="text-xs text-critical">Couldn&apos;t load the room. Retrying every 15 seconds.</p>
                )}
                <p className="flex gap-2 text-xs text-muted-foreground">
                  <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  Stakeholders answer through private links. Their answers are stored server-side and
                  never shown to you: this view only shows where views diverge.
                </p>
              </>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={loadDemoRoom}>
                    Load demo answers
                  </Button>
                  <Button variant="ghost" size="sm" onClick={clearRoom}>
                    Clear all answers
                  </Button>
                </div>
                <p className="flex gap-2 text-xs text-muted-foreground">
                  <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  Answers stay in this browser tab and are never stored or sent anywhere. Reloading the
                  page clears them.
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Executive summary</CardTitle>
            <CardDescription>
              A branded PDF of the scenario, governance, stress test and these gaps, for the client file.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ExportDialog gaps={companyId ? remote.data : localGaps} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Consensus on the current scenario</CardTitle>
            <CardDescription>Using each stakeholder&apos;s own priorities</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-0.5">
                <span className="text-xs text-muted-foreground">Alignment</span>
                <span className="font-mono text-2xl text-metric tabular-nums">{Math.round(matrix.alignment)}</span>
              </div>
              <div className="grid gap-0.5">
                <span className="text-xs text-muted-foreground">Economics</span>
                <span className="font-mono text-2xl text-metric tabular-nums">{Math.round(matrix.economics)}</span>
              </div>
            </div>
            <ul className="grid gap-1 text-sm">
              {matrix.stakeholders.map((s) => (
                <li key={s.id} className="flex justify-between">
                  {s.label}
                  <span className="font-mono tabular-nums">{Math.round(s.support)}</span>
                </li>
              ))}
            </ul>
            <Link href="/simulator" className="text-xs text-foreground underline underline-offset-4">
              Adjust the scenario in the simulator
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Misperceptions</CardTitle>
            <CardDescription>Where someone has misjudged how another stakeholder sees things</CardDescription>
          </CardHeader>
          <CardContent>
            {gaps.misperceptions.length ? (
              <ul className="grid gap-2">
                {gaps.misperceptions.map((m) => (
                  <li
                    key={`${m.observer}-${m.topicId}`}
                    className={cn("grid gap-0.5 rounded-lg px-3 py-2", SEVERITY_STYLES[m.severity])}
                  >
                    <span className="text-sm font-medium">
                      The {STAKEHOLDER_LABELS[m.observer]} misreads the {STAKEHOLDER_LABELS[m.target]}
                    </span>
                    <span className="text-xs text-foreground/70">
                      “{m.topic}”: {m.severity === "critical" ? "a major" : "a meaningful"} gap between
                      what was expected and what was said.
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                {submittedCount < 2
                  ? "Appears once a stakeholder and the person they predicted have both submitted."
                  : "No misperceptions: everyone read each other accurately."}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Disagreements</CardTitle>
            <CardDescription>Topics where positions are far apart. No names are shown.</CardDescription>
          </CardHeader>
          <CardContent>
            {gaps.disagreements.length ? (
              <ul className="grid gap-2">
                {gaps.disagreements.map((d) => (
                  <li
                    key={d.topicId}
                    className={cn("flex items-baseline justify-between gap-4 rounded-lg px-3 py-2", SEVERITY_STYLES[d.severity])}
                  >
                    <span className="text-sm">“{d.topic}”</span>
                    <span className="shrink-0 font-mono text-xs tabular-nums">{d.spread} pts apart</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                {submittedCount < 2
                  ? "Appears once at least two stakeholders have submitted."
                  : "No significant disagreements."}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
