"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExplainButton } from "@/components/explain/explain-button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BriefCard } from "@/components/narrative/brief-card";
import { explainGovernance } from "@/lib/explain/governance";
import { governanceBrief } from "@/lib/narrative/governance";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/segmented";
import {
  CATEGORY_LABELS,
  DEMO_GOVERNANCE,
  MAX_BOARD_SEATS,
  MAX_GOVERNANCE_DISCOUNT,
  governanceDebtValue,
  scoreGovernance,
} from "@/lib/governance/model";
import type {
  GovernanceAnswers,
  GovernanceCategoryId,
  MeetingCadence,
  Practice,
} from "@/lib/governance/types";
import { parseNumber } from "@/lib/parse-number";
import { clamp } from "@/lib/simulator/defaults";
import { GOVERNANCE_CAUTION, GOVERNANCE_CRITICAL, simulate } from "@/lib/simulator/engine";
import { formatMoney, formatPercent } from "@/lib/simulator/format";
import { useSimulatorStore } from "@/lib/simulator/store";
import type { Severity } from "@/lib/simulator/types";
import { cn } from "@/lib/utils";

type PracticeKey = {
  [K in keyof GovernanceAnswers]: GovernanceAnswers[K] extends Practice ? K : never;
}[keyof GovernanceAnswers];
type SeatKey = "boardSeatsFilled" | "boardSeatsRecommended" | "independentDirectors";

type Question =
  | { kind: "practice"; key: PracticeKey; label: string; hint: string }
  | { kind: "seats"; key: SeatKey; label: string; hint: string }
  | { kind: "cadence"; key: "meetingCadence"; label: string; hint: string };

const QUESTIONS: Record<GovernanceCategoryId, Question[]> = {
  authority: [
    { kind: "practice", key: "delegationOfAuthority", label: "Delegation of authority", hint: "Who can sign, spend and hire, written down" },
    { kind: "practice", key: "successionPlan", label: "CEO succession plan", hint: "A named successor and a written transition plan" },
    { kind: "practice", key: "incapacitationPlan", label: "Incapacitation plan", hint: "Powers of attorney, key-person cover, an emergency successor" },
  ],
  board: [
    { kind: "seats", key: "boardSeatsFilled", label: "Board seats filled", hint: "Directors currently serving" },
    { kind: "seats", key: "boardSeatsRecommended", label: "Recommended board size", hint: "Seats the company should have" },
    { kind: "seats", key: "independentDirectors", label: "Independent directors", hint: "Non-family, non-employee directors (target 2)" },
    { kind: "cadence", key: "meetingCadence", label: "Board meeting cadence", hint: "How often the board formally meets" },
  ],
  voting: [
    { kind: "practice", key: "buySellAgreement", label: "Shareholder / buy-sell agreement", hint: "Rules for transfers, exits, death and divorce" },
    { kind: "practice", key: "votingRules", label: "Written voting rules", hint: "Who votes on what, and by what majority" },
    { kind: "practice", key: "disputeResolution", label: "Dispute resolution", hint: "A family council or agreed escalation path" },
  ],
};

const PRACTICE_OPTIONS: { value: Practice; label: string }[] = [
  { value: "yes", label: "In place" },
  { value: "partial", label: "Partial" },
  { value: "no", label: "Missing" },
];

const CADENCE_OPTIONS: { value: MeetingCadence; label: string }[] = [
  { value: "quarterly", label: "Quarterly+" },
  { value: "annual", label: "Annual" },
  { value: "adhoc", label: "Ad hoc" },
];

const TONE_TEXT: Record<Severity, string> = {
  positive: "text-positive",
  caution: "text-caution",
  critical: "text-critical",
};
const TONE_BAR: Record<Severity, string> = {
  positive: "bg-positive",
  caution: "bg-caution",
  critical: "bg-critical",
};

function scoreTone(score: number): Severity {
  if (score >= GOVERNANCE_CRITICAL) return "critical";
  if (score >= GOVERNANCE_CAUTION) return "caution";
  return "positive";
}

function SeatInput({ labelId, value, onChange }: { labelId: string; value: number; onChange: (value: number) => void }) {
  // Raw text while editing; null shows the stored value.
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <Input
      aria-labelledby={labelId}
      inputMode="numeric"
      autoComplete="off"
      className="w-20 text-right font-mono"
      value={draft ?? String(value)}
      onFocus={(e) => setDraft(e.currentTarget.value)}
      onChange={(e) => {
        setDraft(e.currentTarget.value);
        const parsed = parseNumber(e.currentTarget.value);
        if (parsed !== null) onChange(Math.round(clamp(parsed, { min: 0, max: MAX_BOARD_SEATS })));
      }}
      onBlur={() => setDraft(null)}
    />
  );
}

function QuestionRow({ question }: { question: Question }) {
  const labelId = useId();
  const answers = useSimulatorStore((s) => s.governance);
  const setGovernance = useSimulatorStore((s) => s.setGovernance);

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
      <div className="grid min-w-0 gap-0.5">
        <span id={labelId} className="text-sm font-medium">
          {question.label}
        </span>
        <span className="text-xs text-muted-foreground">{question.hint}</span>
      </div>
      {question.kind === "practice" && (
        <Segmented
          labelId={labelId}
          value={answers[question.key]}
          options={PRACTICE_OPTIONS}
          onChange={(value) => setGovernance({ [question.key]: value })}
        />
      )}
      {question.kind === "cadence" && (
        <Segmented
          labelId={labelId}
          value={answers.meetingCadence}
          options={CADENCE_OPTIONS}
          onChange={(meetingCadence) => setGovernance({ meetingCadence })}
        />
      )}
      {question.kind === "seats" && (
        <SeatInput
          labelId={labelId}
          value={answers[question.key]}
          onChange={(value) => setGovernance({ [question.key]: value })}
        />
      )}
    </div>
  );
}

export function GovernanceCalculator() {
  const answers = useSimulatorStore((s) => s.governance);
  const baseline = useSimulatorStore((s) => s.baseline);
  const scenario = useSimulatorStore((s) => s.scenario);
  const setGovernance = useSimulatorStore((s) => s.setGovernance);

  const governance = useMemo(() => scoreGovernance(answers), [answers]);
  const enterpriseValue = useMemo(
    () => simulate(baseline, scenario).enterpriseValue,
    [baseline, scenario],
  );
  const atRisk = governanceDebtValue(enterpriseValue, governance.score);
  const brief = useMemo(() => governanceBrief(answers, enterpriseValue), [answers, enterpriseValue]);
  const tone = scoreTone(governance.score);
  const biggestGaps = governance.items
    .filter((item) => item.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, 5);

  return (
    <div className="grid gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-2">
          <p className="font-mono text-xs uppercase tracking-widest text-metric">
            Governance Debt Calculator
          </p>
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-white md:text-3xl">
            Price the governance you don&apos;t have
          </h1>
        </div>
        <Button variant="outline" onClick={() => setGovernance(DEMO_GOVERNANCE)}>
          <RotateCcw data-icon="inline-start" />
          Reset to demo
        </Button>
      </header>

      <BriefCard brief={brief} description="How a buyer, lender or investment committee would read this assessment." />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <div className="grid gap-6">
          {(Object.keys(QUESTIONS) as GovernanceCategoryId[]).map((category) => (
            <Card key={category}>
              <CardHeader>
                <CardTitle>{CATEGORY_LABELS[category]}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-5">
                {QUESTIONS[category].map((question) => (
                  <QuestionRow key={question.key} question={question} />
                ))}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 lg:sticky lg:top-6">
          <Card>
            <CardHeader>
              <CardTitle>Governance Debt Score</CardTitle>
              <CardDescription>0 is best practice; 100 is no formal governance.</CardDescription>
              <CardAction>
                <ExplainButton
                  subject="the Governance Debt Score"
                  explain={() => explainGovernance(answers, enterpriseValue)}
                />
              </CardAction>
            </CardHeader>
            <CardContent className="grid gap-5">
              <div className="flex items-baseline gap-1">
                <span className={cn("font-mono text-5xl tabular-nums", TONE_TEXT[tone])}>
                  {Math.round(governance.score)}
                </span>
                <span className="font-mono text-lg text-muted-foreground">/100</span>
              </div>
              <div className="grid gap-1">
                <span className="font-mono text-2xl text-metric tabular-nums">{formatMoney(atRisk)}</span>
                <span className="text-xs text-muted-foreground">
                  Value at risk: up to a {formatPercent(MAX_GOVERNANCE_DISCOUNT)} discount on the{" "}
                  <Link href="/simulator" className="text-foreground underline underline-offset-4">
                    simulator&apos;s
                  </Link>{" "}
                  {formatMoney(enterpriseValue)} enterprise value.
                </span>
              </div>
              <ul className="grid gap-3">
                {governance.categories.map((c) => {
                  const share = c.maxPoints > 0 ? c.points / c.maxPoints : 0;
                  const categoryTone = scoreTone(share * 100);
                  return (
                    <li key={c.id} className="grid gap-1.5">
                      <div className="flex items-baseline justify-between gap-4 text-sm">
                        <span>{c.label}</span>
                        <span className={cn("font-mono tabular-nums", TONE_TEXT[categoryTone])}>
                          {Math.round(c.points)}/{c.maxPoints}
                        </span>
                      </div>
                      <div
                        className="h-1.5 overflow-hidden rounded-full bg-muted"
                        role="meter"
                        aria-label={`${c.label} debt`}
                        aria-valuemin={0}
                        aria-valuemax={c.maxPoints}
                        aria-valuenow={Math.round(c.points)}
                      >
                        <div
                          className={cn("h-full rounded-full transition-[width] duration-300", TONE_BAR[categoryTone])}
                          style={{ width: `${share * 100}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Biggest gaps</CardTitle>
              <CardDescription>Value recovered by closing each gap</CardDescription>
            </CardHeader>
            <CardContent>
              {biggestGaps.length === 0 ? (
                <p className="rounded-lg bg-positive/10 px-3 py-2 text-sm text-positive">
                  No governance gaps. Every practice is in place.
                </p>
              ) : (
                <ul className="grid gap-2">
                  {biggestGaps.map((item) => (
                    <li key={item.id} className="flex items-baseline justify-between gap-4 text-sm">
                      <span className="min-w-0">{item.label}</span>
                      <span className="shrink-0 font-mono text-positive tabular-nums">
                        +{formatMoney(governanceDebtValue(enterpriseValue, item.points))}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
