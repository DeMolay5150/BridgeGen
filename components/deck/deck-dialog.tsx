"use client";

import { useId, useState } from "react";
import { FileCode2, FileText, Loader2, Presentation } from "lucide-react";
import { WATERMARKS, WATERMARK_TEXT, footerText, type Watermark } from "@/components/pdf/chrome";
import { Segmented } from "@/components/segmented";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildIcDeck } from "@/lib/deck/ic";
import { buildRedTeamDeck, toMarp, type Deck } from "@/lib/deck/redteam";
import { downloadBlob, exportFileName } from "@/lib/download";
import type { RoomGaps } from "@/lib/room/types";
import { reportExport } from "@/lib/room/use-room-api";
import { selectSnapshot, useSimulatorStore } from "@/lib/simulator/store";

type Format = "pptx" | "pdf" | "md";
export type DeckKind = "redTeam" | "ic";

const FORMATS: { id: Format; label: string; hint: string; icon: typeof Presentation }[] = [
  { id: "pptx", label: "PowerPoint", hint: "Editable .pptx, 16:9", icon: Presentation },
  { id: "pdf", label: "PDF slides", hint: "One slide per page, ready to present", icon: FileText },
  { id: "md", label: "Marp markdown", hint: "Plain-text deck for marp-cli or VS Code", icon: FileCode2 },
];

const KINDS: Record<DeckKind, { trigger: string; title: string; file: string; describe: (company: string) => string }> = {
  redTeam: {
    trigger: "Build deck",
    title: "Red Team deck",
    file: "red-team-deck",
    describe: (c) => `Stress-test slides on ${c}: bottom line, findings, stress scenarios, breaking points and actions.`,
  },
  ic: {
    trigger: "IC deck",
    title: "Investment committee deck",
    file: "ic-deck",
    describe: (c) =>
      `A client-ready IC memo on ${c}: the decision against today, ten-year statements, range of outcomes, liquidity, stress tests, governance and actions.`,
  },
};

async function render(deck: Deck, format: Format, watermark: Watermark): Promise<Blob> {
  const footer = footerText(deck.company, watermark);
  if (format === "md") return new Blob([toMarp(deck, footer)], { type: "text/markdown;charset=utf-8" });
  if (format === "pptx") {
    const { deckToPptx } = await import("@/lib/deck/pptx");
    const mark = watermark === "none" ? undefined : WATERMARK_TEXT[watermark];
    return (await deckToPptx(deck, "blob", { footer, watermark: mark })) as Blob;
  }
  const [{ pdf }, { DeckDocument }] = await Promise.all([import("@react-pdf/renderer"), import("./deck-pdf")]);
  return pdf(<DeckDocument deck={deck} watermark={watermark} />).toBlob();
}

/**
 * One-click decks for the live scenario, in three formats built from one
 * slide model. `gaps` (Decision Room findings, never answers) adds the
 * alignment slide to the IC deck. Renderers load only when a format is chosen.
 */
export function DeckDialog({ kind, gaps = null }: { kind: DeckKind; gaps?: RoomGaps | null }) {
  const nameId = useId();
  const watermarkId = useId();
  const companyName = useSimulatorStore((s) => s.companyName) ?? "Demo company";
  const [preparedBy, setPreparedBy] = useState("");
  const [watermark, setWatermark] = useState<Watermark>("confidential");
  const [working, setWorking] = useState<Format | null>(null);
  const [failed, setFailed] = useState(false);
  const spec = KINDS[kind];

  const download = async (format: Format) => {
    setWorking(format);
    setFailed(false);
    try {
      const state = useSimulatorStore.getState();
      const generatedAt = new Date();
      const common = { companyName, preparedBy: preparedBy.trim(), generatedAt };
      const deck =
        kind === "ic"
          ? buildIcDeck({ ...common, snapshot: selectSnapshot(state), gaps })
          : buildRedTeamDeck({ ...common, baseline: state.baseline, scenario: state.scenario, governance: state.governance });
      downloadBlob(await render(deck, format, watermark), exportFileName(companyName, spec.file, format, generatedAt));
      reportExport(state.companyId, "deck.exported", format);
    } catch {
      setFailed(true);
    } finally {
      setWorking(null);
    }
  };

  return (
    <Dialog onOpenChange={(open) => open && setFailed(false)}>
      <DialogTrigger render={<Button variant="outline" />}>
        <Presentation data-icon="inline-start" />
        {spec.trigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{spec.title}</DialogTitle>
          <DialogDescription>{spec.describe(companyName)}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor={nameId}>Prepared by</Label>
          <Input
            id={nameId}
            value={preparedBy}
            maxLength={120}
            placeholder="e.g. Jordan Lee, Meridian Family Office"
            onChange={(e) => setPreparedBy(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span id={watermarkId} className="text-sm">
            Watermark
          </span>
          <Segmented
            labelId={watermarkId}
            value={watermark}
            options={WATERMARKS.map((w) => ({ value: w.id, label: w.label }))}
            onChange={setWatermark}
          />
        </div>
        <ul className="grid gap-2">
          {FORMATS.map(({ id, label, hint, icon: Icon }) => (
            <li key={id}>
              <Button
                variant="outline"
                className="h-auto w-full justify-start gap-3 px-3 py-2.5 text-left"
                disabled={working !== null}
                onClick={() => void download(id)}
              >
                {working === id ? <Loader2 className="animate-spin" /> : <Icon />}
                <span className="grid gap-0.5">
                  <span className="text-sm">{label}</span>
                  <span className="text-xs font-normal text-muted-foreground">{hint}</span>
                </span>
              </Button>
            </li>
          ))}
        </ul>
        {failed && (
          <p role="alert" className="rounded-lg bg-critical/10 px-3 py-2 text-sm text-critical">
            Couldn&apos;t build the deck. Please try again.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
