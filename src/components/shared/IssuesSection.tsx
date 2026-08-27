"use client";

import { Search } from "lucide-react";
import type { Issue } from "@/app/lib/api";
import { Section } from "@/components/shared/DetailPanelKit";

/* Shared "Issues" block for node detail panels and workflow-level lists. */

const TONE: Record<Issue["severity"], { text: string; accent: string; label: string }> = {
  error: { text: "var(--err-text)", accent: "var(--err)", label: "error" },
  warn: { text: "var(--warn-text)", accent: "var(--warn)", label: "warning" },
  info: { text: "var(--off-text)", accent: "var(--off)", label: "info" },
};

export function IssueChip({ issue }: { issue: Issue }) {
  const t = TONE[issue.severity];
  return (
    <span
      className="inline-flex rounded-full border px-2 py-[2px] text-[10.5px] font-semibold"
      style={{
        color: t.text,
        borderColor: `color-mix(in srgb, ${t.accent} 40%, transparent)`,
        background: `color-mix(in srgb, ${t.accent} 10%, transparent)`,
      }}
    >
      {issue.code}
    </span>
  );
}

export function IssueCountChips({
  counts,
}: {
  counts: { error: number; warn: number; info: number } | undefined;
}) {
  if (!counts || (counts.error === 0 && counts.warn === 0)) return null;
  return (
    <span className="inline-flex items-center gap-1">
      {counts.error > 0 && (
        <span
          className="rounded-full border px-2 py-[2px] text-[10.5px] font-semibold"
          style={{
            color: "var(--err-text)",
            borderColor: "color-mix(in srgb, var(--err) 40%, transparent)",
            background: "color-mix(in srgb, var(--err) 10%, transparent)",
          }}
        >
          {counts.error} error{counts.error === 1 ? "" : "s"}
        </span>
      )}
      {counts.warn > 0 && (
        <span
          className="rounded-full border px-2 py-[2px] text-[10.5px] font-semibold"
          style={{
            color: "var(--warn-text)",
            borderColor: "color-mix(in srgb, var(--warn) 40%, transparent)",
            background: "color-mix(in srgb, var(--warn) 10%, transparent)",
          }}
        >
          {counts.warn} warn
        </span>
      )}
    </span>
  );
}

export function IssuesSection({
  issues,
  onFindUses,
}: {
  issues: Issue[] | undefined;
  onFindUses?: (ref: { kind: string; value: string; label?: string | null }) => void;
}) {
  if (!issues || issues.length === 0) return null;
  return (
    <Section title={`Issues · ${issues.length}`}>
      <ul className="flex flex-col gap-2">
        {issues.map((i, idx) => {
          const t = TONE[i.severity];
          const refKind = i.data?.refKind as string | undefined;
          const refValue = i.data?.refValue as string | undefined;
          return (
            <li
              key={`${i.code}:${idx}`}
              className="rounded-card border px-3 py-2"
              style={{
                borderColor: `color-mix(in srgb, ${t.accent} 35%, transparent)`,
                background: `color-mix(in srgb, ${t.accent} 7%, transparent)`,
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: t.text }}>
                  {t.label} · {i.code}
                </span>
                {onFindUses && refKind && refValue && (
                  <button
                    type="button"
                    onClick={() => onFindUses({ kind: refKind, value: refValue })}
                    className="flex items-center gap-1 text-[11px] text-t3 hover:text-t1"
                    aria-label="Find all uses of the referenced asset"
                  >
                    <Search aria-hidden="true" className="size-3" /> uses
                  </button>
                )}
              </div>
              <p className="mt-0.5 text-[12.5px] text-t1">{i.message}</p>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
