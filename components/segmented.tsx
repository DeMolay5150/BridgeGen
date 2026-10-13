"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

/** Single-select segmented control. Always keeps one option selected once chosen. */
export function Segmented<T extends string>({
  labelId,
  value,
  options,
  onChange,
}: {
  labelId: string;
  /** Undefined renders with nothing selected (e.g. an unanswered question). */
  value: T | undefined;
  options: { value: T; label: string; title?: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <ToggleGroup
      aria-labelledby={labelId}
      variant="outline"
      size="sm"
      spacing={0}
      value={value === undefined ? [] : [value]}
      // Base UI reports [] when the pressed item is clicked again; keep the current answer.
      onValueChange={(next) => {
        const selected = next[0];
        if (selected) onChange(selected as T);
      }}
    >
      {options.map((option) => (
        <ToggleGroupItem key={option.value} value={option.value} title={option.title} className="px-3">
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
