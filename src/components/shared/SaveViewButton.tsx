"use client";

import { useEffect, useRef, useState } from "react";
import { Bookmark } from "lucide-react";
import { createView, SavedView } from "@/app/lib/api";

/* "Save view" — names the current filter state and shares it with the
   workspace (sidebar → Views). */
export function SaveViewButton({
  kind,
  filters,
  onSaved,
}: {
  kind: SavedView["kind"];
  filters: Record<string, unknown>;
  onSaved?: (v: SavedView) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-control border border-line-strong px-2.5 py-1 text-[12px] font-semibold text-t2 hover:text-t1"
        title="Save the current filters as a shared view"
      >
        <Bookmark aria-hidden="true" className="size-3" />
        {saved ? `Saved “${saved}”` : "Save view"}
      </button>
      {open && (
        <form
          className="absolute right-0 top-full z-20 mt-1.5 flex w-[260px] items-center gap-1.5 rounded-card border border-line bg-panel p-2 shadow-[0_12px_30px_var(--ambient)]"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!name.trim()) return;
            setBusy(true);
            try {
              const v = await createView({ name: name.trim(), kind, filters, shared: true });
              setSaved(v.name);
              setName("");
              setOpen(false);
              onSaved?.(v);
            } finally {
              setBusy(false);
            }
          }}
        >
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="View name (e.g. Client A · broken)"
            aria-label="View name"
            maxLength={60}
            className="min-w-0 flex-1 rounded-control border border-line bg-pill px-2 py-1 text-[12.5px] text-t1 placeholder:text-t3"
          />
          <button type="submit" disabled={!name.trim() || busy} className="rounded-control border border-line px-2 py-1 text-[12px] font-semibold text-t2 hover:text-t1 disabled:opacity-50">
            Save
          </button>
        </form>
      )}
    </div>
  );
}
