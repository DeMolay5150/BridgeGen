"use client";

import { useId, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { parseNumber } from "@/lib/parse-number";
import { DEFAULT_HEIRS, MAX_HEIRS, MAX_HEIR_NAME, normalizeHeirs } from "@/lib/simulator/heirs";
import { formatPercent } from "@/lib/simulator/format";
import { useSimulatorStore } from "@/lib/simulator/store";
import type { Heir } from "@/lib/simulator/types";

const newId = () => `heir-${Math.random().toString(36).slice(2, 10)}`;

function HeirRow({
  heir,
  index,
  normalizedShare,
  canRemove,
  onChange,
  onRemove,
  removeRef,
}: {
  heir: Heir;
  index: number;
  normalizedShare: number;
  canRemove: boolean;
  onChange: (patch: Partial<Heir>) => void;
  onRemove: () => void;
  removeRef: (button: HTMLButtonElement | null) => void;
}) {
  const nameId = useId();
  const shareId = useId();
  const activeId = useId();
  // Raw text while the share is being edited; null shows the stored value.
  const [draft, setDraft] = useState<string | null>(null);
  const label = heir.name.trim() || `Heir ${index + 1}`;

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_6rem_auto] items-end gap-3 sm:grid-cols-[minmax(0,1fr)_6rem_auto_auto]">
      <div className="grid gap-1.5">
        <Label htmlFor={nameId} className="text-xs text-muted-foreground">
          Name
          <span className="sr-only"> of heir {index + 1}</span>
        </Label>
        <Input
          id={nameId}
          autoComplete="off"
          maxLength={MAX_HEIR_NAME}
          value={heir.name}
          onChange={(e) => onChange({ name: e.currentTarget.value })}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={shareId} className="text-xs text-muted-foreground">
          Share
          <span className="sr-only"> of heir {index + 1}</span>
        </Label>
        <div className="relative">
          <Input
            id={shareId}
            inputMode="decimal"
            autoComplete="off"
            className="pr-7 font-mono"
            aria-describedby={`${shareId}-scaled`}
            value={draft ?? String(Math.round(heir.share * 10_000) / 100)}
            onFocus={(e) => setDraft(e.currentTarget.value)}
            onChange={(e) => {
              setDraft(e.currentTarget.value);
              const parsed = parseNumber(e.currentTarget.value);
              if (parsed !== null && parsed >= 0) onChange({ share: parsed / 100 });
            }}
            onBlur={() => setDraft(null)}
          />
          <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center font-mono text-sm text-muted-foreground">
            %
          </span>
        </div>
        <span id={`${shareId}-scaled`} className="sr-only">
          Counts as {formatPercent(normalizedShare)} of the transferred stake.
        </span>
      </div>
      <div className="col-span-3 flex items-center justify-between gap-3 sm:col-span-1 sm:grid sm:gap-1.5">
        <Label htmlFor={activeId} className="text-xs text-muted-foreground">
          Works in the business
          <span className="sr-only"> (heir {index + 1})</span>
        </Label>
        <Switch id={activeId} checked={heir.active} onCheckedChange={(active) => onChange({ active })} className="sm:my-2.5" />
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="row-start-1 col-start-3 size-10 sm:col-start-4"
        ref={removeRef}
        disabled={!canRemove}
        aria-label={`Remove heir ${index + 1}: ${label}`}
        onClick={onRemove}
      >
        <X />
      </Button>
    </li>
  );
}

/** Names the next generation and how a transfer splits between them. */
export function HeirsEditor() {
  const stored = useSimulatorStore((s) => s.baseline.heirs);
  const setBaseline = useSimulatorStore((s) => s.setBaseline);
  const headingId = useId();
  const removeButtons = useRef(new Map<string, HTMLButtonElement>());
  const addButton = useRef<HTMLButtonElement>(null);
  const heirs = stored && stored.length > 0 ? stored : DEFAULT_HEIRS;
  const normalized = normalizeHeirs(heirs);
  const total = heirs.reduce((sum, h) => sum + (Number.isFinite(h.share) && h.share > 0 ? h.share : 0), 0);
  const scaled = Math.abs(total - 1) > 0.0001;

  const save = (next: Heir[]) => setBaseline({ heirs: next });
  const update = (index: number, patch: Partial<Heir>) =>
    save(heirs.map((h, i) => (i === index ? { ...h, ...patch } : h)));
  // The removed row takes its button with it: keep keyboard focus nearby, not back at the top of the page.
  const remove = (index: number) => {
    const rest = heirs.filter((_, j) => j !== index);
    const next = rest[Math.max(0, index - 1)];
    save(rest);
    requestAnimationFrame(() => {
      const target = rest.length > 1 && next ? removeButtons.current.get(next.id) : null;
      (target ?? addButton.current)?.focus();
    });
  };

  return (
    <section className="col-span-2 grid gap-3 border-t border-border pt-4" aria-labelledby={headingId}>
      <div className="grid gap-0.5">
        <h3 id={headingId} className="text-sm font-medium">
          Next generation
        </h3>
        <p className="text-sm text-muted-foreground">
          How any equity the founder transfers splits between heirs. The successor-exit stress test buys out the
          largest heir who works in the business.
        </p>
      </div>
      <ul className="grid gap-4">
        {heirs.map((heir, i) => (
          <HeirRow
            key={heir.id}
            heir={heir}
            index={i}
            normalizedShare={normalized[i].share}
            canRemove={heirs.length > 1}
            onChange={(patch) => update(i, patch)}
            onRemove={() => remove(i)}
            removeRef={(button) => {
              if (button) removeButtons.current.set(heir.id, button);
              else removeButtons.current.delete(heir.id);
            }}
          />
        ))}
      </ul>
      <p role="status" className="text-xs text-caution empty:hidden">
        {scaled &&
          `Shares add up to ${formatPercent(total)}, so they're scaled to 100%: ${normalized
            .map((h) => `${h.name} ${formatPercent(h.share)}`)
            .join(", ")}.`}
      </p>
      <Button
        ref={addButton}
        variant="outline"
        size="sm"
        className="w-fit"
        disabled={heirs.length >= MAX_HEIRS}
        onClick={() =>
          // Starts at 0% so adding someone never silently moves the existing split.
          save([...heirs, { id: newId(), name: `Heir ${heirs.length + 1}`, share: 0, active: false }])
        }
      >
        <Plus data-icon="inline-start" />
        Add heir
      </Button>
    </section>
  );
}
