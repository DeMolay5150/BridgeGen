"use client";

import { useId, type ReactNode } from "react";
import { EyeOff, Lock } from "lucide-react";
import { Segmented } from "@/components/segmented";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PREDICTION_TARGET, RATING_LABELS, TOPICS, isComplete } from "@/lib/room/topics";
import type { Rating, RoomResponse, TopicId } from "@/lib/room/types";
import { STAKEHOLDER_LABELS, type StakeholderId } from "@/lib/simulator/alignment";
import { useSimulatorStore } from "@/lib/simulator/store";

const RATINGS: Rating[] = [1, 2, 3, 4, 5];
const RATING_OPTIONS = RATINGS.map((r) => ({ value: String(r), label: String(r), title: RATING_LABELS[r] }));

interface FormProps {
  targetLabel: string;
  response: RoomResponse | undefined;
  /** Receives a patch; the owner applies it with `applyResponsePatch`. */
  onChange: (patch: Partial<RoomResponse>) => void;
  /** Shown above the questions. */
  description: ReactNode;
  /** Shown once submitted. */
  submittedMessage: ReactNode;
  busy?: boolean;
}

function TopicRow({
  topicId,
  statement,
  targetLabel,
  response,
  onChange,
}: { topicId: TopicId; statement: string } & Pick<FormProps, "targetLabel" | "response" | "onChange">) {
  const statementId = useId();
  const predictionId = useId();
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
          onChange={(v) => onChange({ positions: { [topicId]: Number(v) as Rating } })}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <span id={predictionId} className="text-xs text-muted-foreground">
          How will the {targetLabel} answer?
        </span>
        <Segmented
          labelId={predictionId}
          value={prediction === undefined ? undefined : String(prediction)}
          options={RATING_OPTIONS}
          onChange={(v) => onChange({ predictions: { [topicId]: Number(v) as Rating } })}
        />
      </div>
    </li>
  );
}

/** The private questionnaire itself, independent of where answers are stored. */
export function QuestionnaireForm({ targetLabel, response, onChange, description, submittedMessage, busy = false }: FormProps) {
  const complete = response !== undefined && isComplete(response.positions) && isComplete(response.predictions);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="size-4 text-muted-foreground" aria-hidden />
          Private questionnaire
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {response?.submitted ? (
          <div className="grid gap-3 rounded-lg bg-positive/10 px-4 py-3">
            <p className="flex items-center gap-2 text-sm text-positive">
              <EyeOff className="size-4 shrink-0" aria-hidden />
              {submittedMessage}
            </p>
            <Button variant="ghost" size="sm" className="w-fit" disabled={busy} onClick={() => onChange({ submitted: false })}>
              Edit my answers
            </Button>
          </div>
        ) : (
          <div className="grid gap-5">
            <p className="font-mono text-xs text-muted-foreground">1 = strongly disagree · 5 = strongly agree</p>
            <ul className="grid gap-5">
              {TOPICS.map((topic) => (
                <TopicRow
                  key={topic.id}
                  topicId={topic.id}
                  statement={topic.statement}
                  targetLabel={targetLabel}
                  response={response}
                  onChange={onChange}
                />
              ))}
            </ul>
            <Button className="w-fit" disabled={!complete || busy} onClick={() => onChange({ submitted: true })}>
              <EyeOff data-icon="inline-start" />
              {busy ? "Saving…" : "Submit & hide"}
            </Button>
            {!complete && <p className="text-xs text-muted-foreground">Answer every question to submit.</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Demo mode: answers live in this browser tab only. */
export function Questionnaire({ stakeholder }: { stakeholder: StakeholderId }) {
  const response = useSimulatorStore((s) => s.room[stakeholder]);
  const setResponse = useSimulatorStore((s) => s.setResponse);
  const label = STAKEHOLDER_LABELS[stakeholder];

  return (
    <QuestionnaireForm
      targetLabel={STAKEHOLDER_LABELS[PREDICTION_TARGET[stakeholder]]}
      response={response}
      onChange={(patch) => setResponse(stakeholder, patch)}
      description={`Only the ${label} should answer. Other views never show these answers, and the facilitator sees only where views diverge, never who said what.`}
      submittedMessage="Answers recorded and hidden. Hand the device to the next person."
    />
  );
}
