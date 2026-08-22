"use client";

import type { LucideIcon } from "lucide-react";
import { Activity, GitCompareArrows, Info, MessageSquare, StickyNote } from "lucide-react";

/*
 * Vertical tool rail on the left edge of a workflow canvas. The header stays
 * identity-only (back · name · status · open-in); every inspector lives
 * here, one open at a time, with badges for what needs attention. Adding a
 * tool = adding an entry, not another header chip.
 */

export type RailTool = "info" | "changes" | "comments" | "runs" | "notes";

export interface RailItem {
  id: RailTool;
  label: string;
  icon: LucideIcon;
  badge?: string | number | null;
  tone?: "warn" | "err" | "ok" | "muted";
  hidden?: boolean;
}

const TONE: Record<NonNullable<RailItem["tone"]>, { text: string; accent: string }> = {
  warn: { text: "var(--warn-text)", accent: "var(--warn)" },
  err: { text: "var(--err-text)", accent: "var(--err)" },
  ok: { text: "var(--ok-text)", accent: "var(--ok)" },
  muted: { text: "var(--t3)", accent: "var(--t3)" },
};

export const RAIL_ICONS: Record<RailTool, LucideIcon> = {
  info: Info,
  changes: GitCompareArrows,
  comments: MessageSquare,
  runs: Activity,
  notes: StickyNote,
};

export function InspectorRail({
  items,
  active,
  onToggle,
}: {
  items: RailItem[];
  active: RailTool | null;
  onToggle: (id: RailTool) => void;
}) {
  return (
    <nav
      aria-label="Workflow inspectors"
      className="absolute left-3 top-1/2 z-[3] flex -translate-y-1/2 flex-col gap-1 rounded-[14px] border border-line bg-glass p-1 backdrop-blur-[10px]"
    >
      {items
        .filter((i) => !i.hidden)
        .map((i) => {
          const Icon = i.icon;
          const isActive = active === i.id;
          const tone = i.tone ? TONE[i.tone] : null;
          return (
            <button
              key={i.id}
              type="button"
              onClick={() => onToggle(i.id)}
              aria-pressed={isActive}
              aria-label={`${i.label}${i.badge != null && i.badge !== "" ? ` (${i.badge})` : ""}`}
              title={i.label}
              className={`relative flex size-9 items-center justify-center rounded-[10px] transition-colors ${
                isActive ? "bg-pill text-t1 shadow-[0_4px_14px_var(--shade)]" : "text-t3 hover:bg-hover hover:text-t1"
              }`}
            >
              <Icon aria-hidden="true" className="size-4" />
              {i.badge != null && i.badge !== "" && i.badge !== 0 && (
                <span
                  aria-hidden="true"
                  className="absolute -right-1 -top-1 min-w-[16px] rounded-full border border-plane px-1 text-center text-[9px] font-semibold leading-[14px]"
                  style={{
                    color: tone?.text ?? "var(--t1)",
                    background: tone ? `color-mix(in srgb, ${tone.accent} 22%, var(--pill))` : "var(--pill)",
                  }}
                >
                  {i.badge}
                </span>
              )}
            </button>
          );
        })}
    </nav>
  );
}
