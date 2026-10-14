"use client";

import { useId, useState } from "react";
import { FileCode2, FileText, Loader2, Presentation } from "lucide-react";
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
import { buildRedTeamDeck, toMarp, type Deck } from "@/lib/deck/redteam";
import { downloadBlob, exportFileName } from "@/lib/download";
import { reportExport } from "@/lib/room/use-room-api";
import { useSimulatorStore } from "@/lib/simulator/store";

type Format = "pptx" | "pdf" | "md";

const FORMATS: { id: Format; label: string; hint: string; icon: typeof Presentation }[] = [
  { id: "pptx", label: "PowerPoint", hint: "Editable .pptx, 16:9", icon: Presentation },
  { id: "pdf", label: "PDF slides", hint: "One slide per page, ready to present", icon: FileText },
  { id: "md", label: "Marp markdown", hint: "Plain-text deck for marp-cli or VS Code", icon: FileCode2 },
];

async function render(deck: Deck, format: Format): Promise<Blob> {
  if (format === "md") return new Blob([toMarp(deck)], { type: "text/markdown;charset=utf-8" });
  if (format === "pptx") {
    const { deckToPptx } = await import("@/lib/deck/pptx");
    return (await deckToPptx(deck, "blob")) as Blob;
  }
  const [{ pdf }, { DeckDocument }] = await Promise.all([import("@react-pdf/renderer"), import("./deck-pdf")]);
  return pdf(<DeckDocument deck={deck} />).toBlob();
}

/**
 * One-click Red Team deck for the live scenario, in three formats built from
 * one slide model. The heavy renderers load only when a format is chosen.
 */
export function DeckDialog() {
  const nameId = useId();
  const companyName = useSimulatorStore((s) => s.companyName) ?? "Demo company";
  const [preparedBy, setPreparedBy] = useState("");
  const [working, setWorking] = useState<Format | null>(null);
  const [failed, setFailed] = useState(false);

  const download = async (format: Format) => {
    setWorking(format);
    setFailed(false);
    try {
      const { baseline, scenario, governance, companyId } = useSimulatorStore.getState();
      const generatedAt = new Date();
      const deck = buildRedTeamDeck({ companyName, preparedBy: preparedBy.trim(), baseline, scenario, governance, generatedAt });
      downloadBlob(await render(deck, format), exportFileName(companyName, "red-team-deck", format, generatedAt));
      reportExport(companyId, "deck.exported", format);
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
        Build deck
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Red Team deck</DialogTitle>
          <DialogDescription>
            Seven slides on {companyName}: bottom line, findings, stress scenarios, breaking points and recommended
            actions, from the figures on this page.
          </DialogDescription>
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
