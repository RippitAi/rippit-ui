"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Plus, TagIcon } from "lucide-react";
import { createTag, setWorkflowTags, Tag } from "@/app/lib/api";
import type { ProviderId } from "@/lib/connectors/types";
import { useTags } from "@/components/tags/tags-context";
import { TagChip } from "@/components/tags/TagChip";

/*
 * Inline tag editor for one workflow: current tags as removable chips, a
 * "+ tag" button opening a small list (toggle existing, create new).
 * Optimistic: updates local state, calls PUT, reverts on error.
 */
export function TagPicker({
  provider,
  externalId,
  tags,
  onChange,
  compact = false,
}: {
  provider: ProviderId;
  externalId: string;
  tags: Tag[];
  onChange: (tags: Tag[]) => void;
  compact?: boolean;
}) {
  const { tags: all, refresh } = useTags();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const commit = async (next: Tag[]) => {
    const prev = tags;
    onChange(next);
    setError("");
    try {
      const res = await setWorkflowTags(provider, externalId, next.map((t) => t.id));
      onChange(res.tags);
    } catch (e) {
      onChange(prev);
      setError((e as Error).message);
    }
  };

  const toggle = (t: Tag) =>
    commit(tags.some((x) => x.id === t.id) ? tags.filter((x) => x.id !== t.id) : [...tags, t]);

  const create = async () => {
    const name = draft.trim();
    if (!name) return;
    try {
      const t = await createTag(name);
      setDraft("");
      refresh();
      await commit([...tags, t]);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div ref={rootRef} className="relative flex flex-wrap items-center gap-1">
      {tags.map((t) => (
        <TagChip key={t.id} tag={t} size={compact ? "xs" : "sm"} onRemove={() => toggle(t)} />
      ))}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1 rounded-full border border-dashed border-line-strong px-2 ${
          compact ? "py-[1px] text-[10.5px]" : "py-[2px] text-[11px]"
        } font-semibold text-t3 transition-colors hover:border-t1 hover:text-t1`}
      >
        <TagIcon aria-hidden="true" className="size-3" />
        {tags.length === 0 ? "tag" : ""}
        <Plus aria-hidden="true" className="size-2.5" />
      </button>
      {open && (
        <div
          id={listId}
          role="dialog"
          aria-label="Edit tags"
          className="absolute left-0 top-full z-20 mt-1.5 w-[240px] rounded-card border border-line bg-panel p-2 shadow-[0_12px_30px_var(--ambient)]"
        >
          <ul className="flex max-h-[200px] flex-col gap-1 overflow-auto">
            {all.length === 0 && (
              <li className="px-1 py-1 text-[12px] text-t3">No tags yet — create one below.</li>
            )}
            {all.map((t) => {
              const on = tags.some((x) => x.id === t.id);
              return (
                <li key={t.id}>
                  <TagChip tag={t} active={on} onClick={() => toggle(t)} />
                </li>
              );
            })}
          </ul>
          <form
            className="mt-2 flex items-center gap-1 border-t border-line2 pt-2"
            onSubmit={(e) => {
              e.preventDefault();
              create();
            }}
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="New tag…"
              aria-label="New tag name"
              maxLength={40}
              className="min-w-0 flex-1 rounded-control border border-line bg-pill px-2 py-1 text-[12px] text-t1 placeholder:text-t3"
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              className="rounded-control border border-line px-2 py-1 text-[11.5px] font-semibold text-t2 hover:text-t1 disabled:opacity-50"
            >
              Add
            </button>
          </form>
          {error && (
            <p role="alert" className="mt-1.5 text-[11.5px] text-err-text">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
