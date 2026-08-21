"use client";

import type { Tag } from "@/app/lib/api";
import { TagChip } from "@/components/tags/TagChip";

/* Row of toggle chips; multiple selected tags = AND. */
export function TagFilter({
  tags,
  selected,
  onChange,
  label = "Filter by tag",
}: {
  tags: Tag[];
  selected: string[];
  onChange: (ids: string[]) => void;
  label?: string;
}) {
  if (tags.length === 0) return null;
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-1">
      {tags.map((t) => (
        <TagChip key={t.id} tag={t} active={selected.includes(t.id)} onClick={() => toggle(t.id)} size="xs" />
      ))}
      {selected.length > 0 && (
        <button
          type="button"
          onClick={() => onChange([])}
          className="text-[10px] text-t3 underline-offset-2 hover:text-t1 hover:underline"
        >
          clear
        </button>
      )}
    </div>
  );
}

/** AND filter: the workflow must carry every selected tag. */
export function matchesTags(workflowTags: Tag[] | undefined, selected: string[]): boolean {
  if (selected.length === 0) return true;
  const have = new Set((workflowTags ?? []).map((t) => t.id));
  return selected.every((id) => have.has(id));
}
