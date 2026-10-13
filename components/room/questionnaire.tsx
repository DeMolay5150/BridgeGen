"use client";

import { useId } from "react";
import { EyeOff, Lock } from "lucide-react";
import { Segmented } from "@/components/segmented";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PREDICTION_TARGET, RATING_LABELS, TOPICS, isComplete } from "@/lib/room/topics";
import type { Rating, TopicId } from "@/lib/room/types";
import { STAKEHOLDER_LABELS, type StakeholderId } from "@/lib/simulator/alignment";
import { useSimulatorStore } from "@/lib/simulator/store";

const RATINGS: Rating[] = [1, 2, 3, 4, 5];
const RATING_OPTIONS = RATINGS.map((r) => ({ value: String(r), label: String(r), title: RATING_LABELS[r] }));

function TopicRow({
  stakeholder,
  topicId,
  statement,
}: {
  stakeholder: StakeholderId;
  topicId: TopicId;
  statement: string;
}) {
  const statementId = useId();
  const predictionId = useId();
  const response = useSimulatorStore((s) => s.room[stakeholder]);
  const setResponse = useSimulatorStore((s) => s.setResponse);
  const target = STAKEHOLDER_LABELS[PREDICTION_TARGET[stakeholder]];
  const position = response?.positions[topicId];
  const prediction = response?.predictions[topicId];

  return (
    <li className="grid gap-3 border-b border-border/60 pb-5 last:border-0 last:pb-0">
      <p id={statementId} className="text-sm font-medium">
        {statement}
      </p>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <span className="text-xs text-muted-foreground">Your view</span>
        <Segmented
          labelId={statementId}
          value={position === undefined ? undefined : String(position)}
          options={RATING_OPTIONS}
          onChange={(v) => setResponse(stakeholder, { positions: { [topicId]: Number(v) as Rating } })}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <span id={predictionId} className="text-xs text-muted-foreground">
          How will the {target} answer?
        </span>
        <Segmented
          labelId={predictionId}
          value={prediction === undefined ? undefined : String(prediction)}
          options={RATING_OPTIONS}
          onChange={(v) => setResponse(stakeholder, { predictions: { [topicId]: Number(v) as Rating } })}
        />
      </div>
    </li>
  );
}

export function Questionnaire({ stakeholder }: { stakeholder: StakeholderId }) {
  const response = useSimulatorStore((s) => s.room[stakeholder]);
  const setResponse = useSimulatorStore((s) => s.setResponse);
  const complete = response !== undefined && isComplete(response.positions) && isComplete(response.predictions);
  const label = STAKEHOLDER_LABELS[stakeholder];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="size-4 text-muted-foreground" aria-hidden />
          Private questionnaire
        </CardTitle>
        <CardDescription>
          Only the {label} should answer. Other views never show these answers, and the facilitator
          sees only where views diverge, never who said what.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {response?.submitted ? (
          <div className="grid gap-3 rounded-lg bg-positive/10 px-4 py-3">
            <p className="flex items-center gap-2 text-sm text-positive">
              <EyeOff className="size-4" aria-hidden />
              Answers recorded and hidden. Hand the device to the next person.
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="w-fit"
              onClick={() => setResponse(stakeholder, { submitted: false })}
            >
              Edit my answers
            </Button>
          </div>
        ) : (
          <div className="grid gap-5">
            <p className="font-mono text-xs text-muted-foreground">1 = strongly disagree · 5 = strongly agree</p>
            <ul className="grid gap-5">
              {TOPICS.map((topic) => (
                <TopicRow key={topic.id} stakeholder={stakeholder} topicId={topic.id} statement={topic.statement} />
              ))}
            </ul>
            <Button
              className="w-fit"
              disabled={!complete}
              onClick={() => setResponse(stakeholder, { submitted: true })}
            >
              <EyeOff data-icon="inline-start" />
              Submit &amp; hide
            </Button>
            {!complete && (
              <p className="text-xs text-muted-foreground">Answer every question to submit.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
