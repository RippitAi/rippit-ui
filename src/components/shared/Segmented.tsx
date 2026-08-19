"use client";

import { ToggleGroup } from "radix-ui";

/**
 * Pill-style single-select segmented control. Radix ToggleGroup provides
 * roving tabindex, arrow-key movement, and pressed-state semantics.
 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(v) => v && onChange(v as T)}
      aria-label={label}
      className="flex items-center overflow-hidden rounded-full border border-line-strong text-[10px] font-semibold"
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          className="cursor-pointer px-2.5 py-[4px] capitalize text-t3 transition-colors hover:text-t1 data-[state=on]:bg-t1 data-[state=on]:text-bg"
        >
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
