"use client";

import { useId, useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { downloadBlob, exportFileName } from "@/lib/download";
import { REPORT_SECTIONS, buildReport, type ReportSectionId } from "@/lib/report/build";
import { detectGaps } from "@/lib/room/gaps";
import type { RoomGaps } from "@/lib/room/types";
import { reportExport } from "@/lib/room/use-room-api";
import { selectSnapshot, useSimulatorStore } from "@/lib/simulator/store";

const MAX_NAME = 120;

function SectionToggle({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4">
      <Label htmlFor={id} className="grid gap-0.5">
        <span>{label}</span>
        <span className="text-xs font-normal text-muted-foreground">{hint}</span>
      </Label>
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  );
}

/**
 * "Export executive summary": pick sections, name the preparer, download a
 * branded PDF. Takes the room's gap analysis only, so no stakeholder's answers
 * can reach the file. react-pdf (~1 MB) is loaded on first download.
 */
export function ExportDialog({ gaps }: { gaps: RoomGaps | null }) {
  const nameId = useId();
  const companyName = useSimulatorStore((s) => s.companyName) ?? "Demo company";
  const [open, setOpen] = useState(false);
  const [preparedBy, setPreparedBy] = useState("");
  const [sections, setSections] = useState<ReportSectionId[]>(REPORT_SECTIONS.map((s) => s.id));
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle");

  const chosen = sections.filter((id) => id !== "room" || gaps !== null);
  const toggle = (id: ReportSectionId, on: boolean) =>
    setSections((current) => (on ? [...current, id] : current.filter((s) => s !== id)));

  const download = async () => {
    setStatus("working");
    try {
      const generatedAt = new Date();
      const report = buildReport({
        companyName,
        preparedBy: preparedBy.trim(),
        snapshot: selectSnapshot(useSimulatorStore.getState()),
        gaps: gaps ?? detectGaps({}),
        sections: chosen,
        generatedAt,
      });
      const [{ pdf }, { ExecutiveSummaryDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./executive-summary-pdf"),
      ]);
      const blob = await pdf(<ExecutiveSummaryDocument report={report} />).toBlob();
      downloadBlob(blob, exportFileName(companyName, "executive-summary", "pdf", generatedAt));
      reportExport(useSimulatorStore.getState().companyId, "report.exported", "pdf");
      setStatus("idle");
      setOpen(false);
    } catch {
      setStatus("error");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setStatus("idle");
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="sm" className="w-fit" />}>
        <FileDown data-icon="inline-start" />
        Export executive summary
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Executive summary PDF</DialogTitle>
          <DialogDescription>
            A branded, multi-page summary of {companyName} for the client file. The Decision Room
            section shows where views diverge, never anyone&apos;s answers.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5">
          <div className="grid gap-1.5">
            <Label htmlFor={nameId}>Prepared by</Label>
            <Input
              id={nameId}
              value={preparedBy}
              maxLength={MAX_NAME}
              placeholder="e.g. Jordan Lee, Meridian Family Office"
              onChange={(e) => setPreparedBy(e.target.value)}
            />
          </div>
          <fieldset className="grid gap-4">
            <legend className="mb-3 text-xs text-muted-foreground">Sections</legend>
            {REPORT_SECTIONS.map((section) => (
              <SectionToggle
                key={section.id}
                label={section.label}
                hint={section.id === "room" && gaps === null ? "Loading the room…" : section.hint}
                checked={chosen.includes(section.id)}
                disabled={section.id === "room" && gaps === null}
                onChange={(on) => toggle(section.id, on)}
              />
            ))}
          </fieldset>
          {status === "error" && (
            <p role="alert" className="rounded-lg bg-critical/10 px-3 py-2 text-sm text-critical">
              Couldn&apos;t build the PDF. Please try again.
            </p>
          )}
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="ghost" />}>Cancel</DialogClose>
          <Button onClick={() => void download()} disabled={status === "working"}>
            {status === "working" ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <FileDown data-icon="inline-start" />}
            {status === "working" ? "Preparing…" : "Download PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
